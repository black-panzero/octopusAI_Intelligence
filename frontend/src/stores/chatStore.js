// src/stores/chatStore.js
// Multi-conversation chat state. Persists to the backend after every send —
// the local store is a cache for rendering and switching conversations.
import { create } from 'zustand';
import { chatApi } from '../api';
import { extractErrorMessage } from '../lib/errors';

// Pair a response's `invocations` list back to the message index of the
// assistant turn that produced them. Each invocation's `id` matches an entry
// in the assistant turn's `tool_calls`.
const pairInvocations = (messages, invocations) => {
  const out = {};
  if (!Array.isArray(invocations) || invocations.length === 0) return out;
  const byId = Object.fromEntries(invocations.map((inv) => [inv.id, inv]));
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role !== 'assistant' || !m.tool_calls) continue;
    const paired = [];
    for (const tc of m.tool_calls) {
      const inv = byId[tc?.id];
      if (inv) paired.push(inv);
    }
    if (paired.length) out[i] = paired;
  }
  return out;
};

const emptyState = () => ({
  messages: [],
  invocationsByIdx: {},
  conversationId: null,
  conversationTitle: 'New conversation',
});

export const useChatStore = create((set, get) => ({
  // Active conversation transcript
  messages: [],
  invocationsByIdx: {},
  conversationId: null,
  conversationTitle: 'New conversation',

  // Sidebar
  conversations: [],
  conversationsLoaded: false,

  // Ephemeral
  loading: false,
  status: null,
  lastError: null,

  // -------------------------------------------------------------------
  // Status + sidebar
  // -------------------------------------------------------------------
  checkStatus: async () => {
    try {
      set({ status: await chatApi.status() });
    } catch {
      set({ status: { configured: false } });
    }
  },

  loadConversations: async () => {
    try {
      const list = await chatApi.listConversations();
      set({ conversations: Array.isArray(list) ? list : [], conversationsLoaded: true });
    } catch (err) {
      set({
        lastError: extractErrorMessage(err, 'Failed to load conversations'),
        conversationsLoaded: true,
      });
    }
  },

  selectConversation: async (conversationId) => {
    if (conversationId == null) {
      set(emptyState());
      return;
    }
    set({ loading: true, lastError: null });
    try {
      const data = await chatApi.getConversation(conversationId);
      set({
        conversationId: data.id,
        conversationTitle: data.title,
        messages: Array.isArray(data.messages) ? data.messages : [],
        invocationsByIdx: pairInvocations(data.messages || [], data.invocations || []),
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        lastError: extractErrorMessage(err, 'Failed to open conversation'),
      });
    }
  },

  newConversation: () => {
    set(emptyState());
  },

  deleteConversation: async (conversationId) => {
    try {
      await chatApi.deleteConversation(conversationId);
      const next = get().conversations.filter((c) => c.id !== conversationId);
      const patch = { conversations: next };
      if (get().conversationId === conversationId) {
        Object.assign(patch, emptyState());
      }
      set(patch);
    } catch (err) {
      set({ lastError: extractErrorMessage(err, 'Failed to delete conversation') });
    }
  },

  renameConversation: async (conversationId, title) => {
    try {
      await chatApi.renameConversation(conversationId, title);
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, title } : c,
        ),
        conversationTitle: s.conversationId === conversationId ? title : s.conversationTitle,
      }));
    } catch (err) {
      set({ lastError: extractErrorMessage(err, 'Failed to rename') });
    }
  },

  // -------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------
  send: async (raw) => {
    const content = (raw || '').trim();
    if (!content || get().loading) return;

    const next = [...get().messages, { role: 'user', content }];
    set({ messages: next, loading: true, lastError: null });

    try {
      const data = await chatApi.send(next, { conversation_id: get().conversationId });

      const invocationsByIdx = pairInvocations(data.messages || [], data.invocations || []);

      // Refresh sidebar: upsert this conversation at the top.
      const existing = get().conversations.filter((c) => c.id !== data.conversation_id);
      const nowIso = new Date().toISOString();
      const updated = [
        { id: data.conversation_id, title: data.conversation_title, updated_at: nowIso, created_at: nowIso },
        ...existing,
      ];

      set({
        messages: Array.isArray(data.messages) ? data.messages : [],
        invocationsByIdx,
        conversationId: data.conversation_id,
        conversationTitle: data.conversation_title,
        conversations: updated,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        lastError: extractErrorMessage(err, 'Chat failed'),
      });
    }
  },

  reset: () => set({
    ...emptyState(),
    conversations: [],
    conversationsLoaded: false,
    loading: false,
    lastError: null,
  }),
}));
