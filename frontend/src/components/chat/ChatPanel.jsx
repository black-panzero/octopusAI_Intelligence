// src/components/chat/ChatPanel.jsx — Figma-matched frosted glass chat.
// Glass bubbles, gold send button, suggestion chips, frosted composer bar.
// Logic fully preserved from prior version.
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useChatStore } from '../../stores/chatStore';
import ConversationSidebar from './ConversationSidebar';
import IntelligencePanel from './IntelligencePanel';
import Markdown from './Markdown';
import ToolResultCard from './ToolResultCard';

const SUGGESTIONS = [
  'Find the cheapest 5kg rice',
  'Compare Pishori Rice and Basmati Rice',
  'Add Brookside milk to my cart',
  'Track Samsung Galaxy A15 under KES 22,000',
  'What is in my cart?',
];

const ChatPanel = ({ compact = false, showSidebar = false, showIntelligence = false }) => {
  const messages = useChatStore((s) => s.messages);
  const invocationsByIdx = useChatStore((s) => s.invocationsByIdx);
  const loading = useChatStore((s) => s.loading);
  const status = useChatStore((s) => s.status);
  const lastError = useChatStore((s) => s.lastError);
  const send = useChatStore((s) => s.send);
  const checkStatus = useChatStore((s) => s.checkStatus);
  const conversationTitle = useChatStore((s) => s.conversationTitle);

  const [input, setInput] = useState('');
  const [intelCollapsed, setIntelCollapsed] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (status === null) checkStatus(); }, [status, checkStatus]);
  useEffect(() => { if (lastError) toast.error(lastError); }, [lastError]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const hasActivity = messages.some((m) => m.role === 'user' || m.content);
  useEffect(() => {
    if (hasActivity && intelCollapsed) setIntelCollapsed(false);
  }, [hasActivity]); // eslint-disable-line

  useEffect(() => {
    if (!loading && inputRef.current && window.matchMedia?.('(min-width: 768px)').matches) {
      inputRef.current.focus();
    }
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    inputRef.current?.focus();
    await send(text);
    inputRef.current?.focus();
  };

  const canChat = status?.configured !== false;
  const rendered = messages.filter(
    (m) => m.role === 'user' || (m.role === 'assistant' && (m.content || m.tool_calls)),
  );

  const stream = (
    <div className="flex flex-col h-full min-h-0">
      {status && !status.configured && (
        <div className="glass glass-border rounded-[var(--r-md)] p-3 text-xs mx-3 mt-3"
             style={{ color: 'var(--color-amber)', background: 'var(--color-amber-soft)' }}>
          AI not configured. Set <code className="font-mono">LLM_API_KEY</code> in backend/.env and restart.
        </div>
      )}

      {!compact && conversationTitle && hasActivity && (
        <div className="px-4 pt-3 pb-1 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
          {conversationTitle}
        </div>
      )}

      <div ref={scrollRef} className={`flex-1 overflow-y-auto glass-scroll p-4 space-y-4 ${compact ? 'text-sm' : ''}`}>
        {/* Empty state — suggestion chips */}
        {rendered.length === 0 && (
          <div className="text-center pt-12 pb-6">
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                 style={{ background: 'var(--brand-gradient)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-[var(--text-sm)] font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
              How can I help you shop smarter?
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!canChat || loading}
                  className="glass-btn glass-btn-surface text-[11px] px-3 py-1.5 rounded-full disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {rendered.map((m) => {
          const realIdx = messages.indexOf(m);
          const invocations = invocationsByIdx[realIdx] || [];

          if (m.role === 'user') {
            return (
              <div key={realIdx} className="flex justify-end">
                <div className="max-w-[80%] glass glass-border rounded-2xl rounded-br-sm px-4 py-2.5 text-[var(--text-sm)]"
                     style={{ color: 'var(--text-primary)' }}>
                  {m.content}
                </div>
              </div>
            );
          }

          return (
            <div key={realIdx} className="flex justify-start gap-2">
              {/* AI avatar */}
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1"
                   style={{ background: 'var(--brand-gradient)' }}>
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="max-w-[88%] space-y-2">
                {m.content && (
                  <div className="glass-heavy glass-border glass-inset rounded-2xl rounded-bl-sm px-4 py-2.5"
                       style={{ color: 'var(--text-primary)' }}>
                    <Markdown>{m.content}</Markdown>
                  </div>
                )}
                {invocations.map((inv) => (
                  <ToolResultCard key={inv.id} invocation={inv} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {loading && (
          <div className="flex justify-start gap-2">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                 style={{ background: 'var(--brand-gradient)' }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3" />
              </svg>
            </div>
            <div className="glass glass-border rounded-2xl rounded-bl-sm px-4 py-2.5 text-[var(--text-sm)] inline-flex items-center gap-2"
                 style={{ color: 'var(--text-tertiary)' }}>
              <div className="w-3 h-3 rounded-full animate-spin"
                   style={{ border: '2px solid var(--glass-border)', borderTopColor: 'var(--brand-green)' }} />
              Finding the best options for you...
            </div>
          </div>
        )}
      </div>

      {/* Composer bar — frosted glass with gold send button */}
      <div className="glass-heavy glass-border-t p-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button type="button" className="w-10 h-10 rounded-full glass glass-border flex items-center justify-center flex-shrink-0"
                  style={{ color: 'var(--text-tertiary)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={canChat ? 'Include the major brands and then compare their features and offerings...' : 'Configure LLM_API_KEY to chat'}
            disabled={!canChat || loading}
            autoFocus
            className="flex-1 glass-input px-4 py-2.5 text-[var(--text-sm)] rounded-full"
          />
          <button
            type="submit"
            disabled={!canChat || loading || !input.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30"
            style={{
              background: (!canChat || loading || !input.trim()) ? 'var(--glass-bg)' : 'var(--color-cta)',
              color: 'white',
              boxShadow: (!canChat || loading || !input.trim()) ? 'none' : '0 2px 8px var(--color-cta-glow)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );

  if (!showSidebar && !showIntelligence) return stream;

  const intelWidth = intelCollapsed ? 52 : 280;

  return (
    <div className="flex h-full min-h-0">
      {showSidebar && (
        <div className="w-56 flex-shrink-0 hidden md:block glass-border" style={{ borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
          <ConversationSidebar />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">{stream}</div>
      {showIntelligence && (
        <div className="flex-shrink-0 transition-[width] duration-200 ease-out hidden lg:block"
             style={{ width: intelWidth }}>
          <IntelligencePanel collapsed={intelCollapsed} onToggle={() => setIntelCollapsed((v) => !v)} />
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
