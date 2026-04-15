// src/stores/chatStore.js
// Chat conversation state shared between the Chat tab and the floating
// widget. Server is the source of truth on each send; we only keep the
// transcript locally for the active session.
import { create } from 'zustand';
import { chatApi } from '../api';
import { extractErrorMessage } from '../lib/errors';

export const useChatStore = create((set, get) => ({
  messages: [],
  // msgIdx (into messages) -> [invocation, ...]
  invocationsByIdx: {},
  loading: false,
  status: null,           // { configured, provider, model }
  lastError: null,

  checkStatus: async () => {
    try {
      const s = await chatApi.status();
      set({ status: s });
    } catch {
      set({ status: { configured: false } });
    }
  },

  send: async (raw) => {
    const content = (raw || '').trim();
    if (!content || get().loading) return;

    const next = [...get().messages, { role: 'user', content }];
    set({ messages: next, loading: true, lastError: null });

    try {
      const data = await chatApi.send(next);
      // Map invocations to the assistant turn that produced them (the last
      // assistant message containing tool_calls in the returned transcript).
      const invs = Array.isArray(data.invocations) ? data.invocations : [];
      let patch = {};
      if (invs.length) {
        let idx = -1;
        for (let i = data.messages.length - 1; i >= 0; i--) {
          const m = data.messages[i];
          if (m.role === 'assistant' && m.tool_calls) { idx = i; break; }
        }
        if (idx !== -1) patch = { [idx]: invs };
      }
      set((state) => ({
        messages: data.messages,
        invocationsByIdx: { ...state.invocationsByIdx, ...patch },
        loading: false,
      }));
    } catch (err) {
      set({
        loading: false,
        lastError: extractErrorMessage(err, 'Chat failed'),
      });
    }
  },

  clear: () => set({ messages: [], invocationsByIdx: {}, lastError: null }),
  reset: () => set({
    messages: [], invocationsByIdx: {},
    loading: false, lastError: null,
  }),
}));
