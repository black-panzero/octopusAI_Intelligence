// src/components/chat/ConversationSidebar.jsx
// Apple-style conversation list — grouped by day, with inline delete.
import React, { useEffect, useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';

const dayBucket = (iso) => {
  if (!iso) return 'Older';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Older';

  const today = new Date();
  const yDay = new Date(); yDay.setDate(today.getDate() - 1);

  const same = (a, b) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();

  if (same(d, today)) return 'Today';
  if (same(d, yDay)) return 'Yesterday';

  const diffDays = Math.floor((today - d) / 86400000);
  if (diffDays < 7) {
    return d.toLocaleDateString('en-KE', { weekday: 'long' });
  }
  if (d.getFullYear() === today.getFullYear()) {
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
};

const ConversationSidebar = () => {
  const conversations = useChatStore((s) => s.conversations);
  const conversationsLoaded = useChatStore((s) => s.conversationsLoaded);
  const activeId = useChatStore((s) => s.conversationId);
  const load = useChatStore((s) => s.loadConversations);
  const select = useChatStore((s) => s.selectConversation);
  const newOne = useChatStore((s) => s.newConversation);
  const del = useChatStore((s) => s.deleteConversation);

  useEffect(() => { if (!conversationsLoaded) load(); }, [conversationsLoaded, load]);

  const groups = useMemo(() => {
    const byBucket = new Map();
    for (const c of conversations) {
      const key = dayBucket(c.updated_at || c.created_at);
      if (!byBucket.has(key)) byBucket.set(key, []);
      byBucket.get(key).push(c);
    }
    return [...byBucket.entries()]; // already ordered by conversations array
  }, [conversations]);

  return (
    <aside className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide font-semibold text-gray-500">
          Chats
        </span>
        <button
          onClick={newOne}
          className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-800"
          title="Start a new conversation"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {!conversationsLoaded && (
          <p className="px-3 text-xs text-gray-400">Loading…</p>
        )}
        {conversationsLoaded && conversations.length === 0 && (
          <p className="px-3 text-xs text-gray-400">
            No saved chats yet.
          </p>
        )}

        {groups.map(([bucket, list]) => (
          <div key={bucket} className="mb-3">
            <p className="px-3 text-[10px] font-semibold tracking-wide text-gray-400 uppercase mb-1">
              {bucket}
            </p>
            <ul>
              {list.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id} className="px-1.5">
                    <div
                      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer ${
                        active ? 'bg-fuchsia-100 text-fuchsia-900' : 'hover:bg-gray-200/60 text-gray-800'
                      }`}
                      onClick={() => select(c.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.title || 'Untitled'}</p>
                        <p className="text-[10px] text-gray-400">
                          {timeLabel(c.updated_at || c.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); del(c.id); }}
                        title="Delete"
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 7V4a1 1 0 011-1h2a1 1 0 011 1v3" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ConversationSidebar;
