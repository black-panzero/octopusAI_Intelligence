// ChatPanel — Figma-faithful rebuild.
// Matches: Page Chat Assistant.png, Requirements Input/Inputed, ProductResearch.
// Logic fully preserved. Only visuals changed.
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useChatStore } from '../../stores/chatStore';
import ConversationSidebar from './ConversationSidebar';
import IntelligencePanel from './IntelligencePanel';
import Markdown from './Markdown';
import ToolResultCard from './ToolResultCard';

const SUGGESTIONS = [
  'I need a deal on a kitchen blender',
  'Compare rice prices across Naivas and Carrefour',
  'Find me a powerful gaming smartphone',
  'Create a weekly groceries shopping list',
  'What is in my cart right now?',
];

// --- AI brain avatar (green circle with brain icon, per Figma) ---
const AiAvatar = () => (
  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
       style={{ background: 'var(--brand-gradient)', boxShadow: '0 2px 8px rgba(45,143,62,0.25)' }}>
    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  </div>
);

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

  // ── Message stream ─────────────────────────────────────────────
  const stream = (
    <div className="flex flex-col h-full min-h-0">
      {/* Config warning */}
      {status && !status.configured && (
        <div className="mx-4 mt-3 rounded-[var(--r-md)] px-4 py-2.5 text-xs"
             style={{ background: 'rgba(245,166,35,0.12)', color: '#92600a', border: '1px solid rgba(245,166,35,0.25)' }}>
          AI not configured. Set <code className="font-mono bg-white/40 px-1 rounded">LLM_API_KEY</code> in backend/.env and restart.
        </div>
      )}

      {/* Title bar */}
      {!compact && conversationTitle && hasActivity && (
        <div className="px-5 pt-3 pb-1">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-tertiary)' }}>
            {conversationTitle}
          </p>
        </div>
      )}

      {/* Scrollable messages */}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto glass-scroll px-5 py-4 space-y-5 ${compact ? '' : ''}`}>

        {/* Empty state */}
        {rendered.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-16 pb-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                 style={{ background: 'var(--brand-gradient)', boxShadow: '0 4px 20px rgba(45,143,62,0.3)' }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Shopping Intelligence
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
              How can I help you shop smarter today?
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!canChat || loading}
                  className="text-[13px] px-4 py-2 rounded-full transition-all disabled:opacity-40"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)',
                    backdropFilter: 'blur(12px)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--glass-bg-heavy)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--glass-bg)'; }}
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

          // --- User message (right-aligned, frosted glass pill) ---
          if (m.role === 'user') {
            return (
              <div key={realIdx} className="flex justify-end">
                <div
                  className="max-w-[75%] rounded-[18px] rounded-br-[4px] px-4 py-2.5"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border-subtle)',
                    backdropFilter: 'blur(var(--blur))',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-base)',
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          }

          // --- AI message (left-aligned, with brain avatar) ---
          return (
            <div key={realIdx} className="flex gap-2.5 items-start">
              <AiAvatar />
              <div className="max-w-[85%] space-y-2">
                {m.content && (
                  <div
                    className="rounded-[18px] rounded-bl-[4px] px-4 py-2.5"
                    style={{
                      background: 'var(--glass-bg-heavy)',
                      border: '1px solid var(--glass-border)',
                      backdropFilter: 'blur(var(--blur-heavy))',
                      boxShadow: 'var(--glass-inset)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-base)',
                    }}
                  >
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

        {/* Loading — Figma "Researching Products" progress bar */}
        {loading && (
          <div className="flex gap-2.5 items-start">
            <AiAvatar />
            <div
              className="rounded-[18px] rounded-bl-[4px] px-5 py-4 min-w-[260px]"
              style={{
                background: 'var(--glass-bg-heavy)',
                border: '1px solid var(--glass-border)',
                backdropFilter: 'blur(var(--blur-heavy))',
              }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Researching Products...
              </p>
              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full overflow-hidden mb-3"
                   style={{ background: 'var(--glass-bg-light)' }}>
                <div
                  className="h-full rounded-full animate-pulse"
                  style={{
                    width: '70%',
                    background: 'linear-gradient(90deg, var(--color-primary), var(--brand-green))',
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-bounce" style={{ color: 'var(--brand-green)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Finding the best options for you.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Composer bar (Figma: frosted strip, +, input, golden arrow) ── */}
      <div style={{
        background: 'var(--glass-bg-heavy)',
        borderTop: '1px solid var(--glass-border-subtle)',
        backdropFilter: 'blur(var(--blur-heavy))',
        padding: '12px 16px',
      }}>
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          {/* + button */}
          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border-subtle)',
              color: 'var(--text-tertiary)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={canChat
              ? 'Include the major brands and then compare their features and offerings...'
              : 'Configure LLM_API_KEY to chat'}
            disabled={!canChat || loading}
            autoFocus
            className="flex-1 px-4 py-2.5 rounded-full text-sm transition-all"
            style={{
              background: 'var(--glass-bg-light)',
              border: '1px solid var(--glass-border-subtle)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--glass-border-subtle)'; e.target.style.boxShadow = 'none'; }}
          />

          {/* Golden send arrow (Figma: yellow/gold circle) */}
          <button
            type="submit"
            disabled={!canChat || loading || !input.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: (!canChat || loading || !input.trim())
                ? 'var(--glass-bg-light)'
                : '#f5a623',
              color: 'white',
              boxShadow: (!canChat || loading || !input.trim())
                ? 'none'
                : '0 4px 12px rgba(245,166,35,0.35)',
              opacity: (!canChat || loading || !input.trim()) ? 0.4 : 1,
              cursor: (!canChat || loading || !input.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );

  // ── Layout with optional sidebar + intel panel ──────────────────
  if (!showSidebar && !showIntelligence) return stream;

  const intelWidth = intelCollapsed ? 48 : 272;

  return (
    <div className="flex h-full min-h-0">
      {showSidebar && (
        <div className="w-56 flex-shrink-0 hidden md:block"
             style={{ borderRight: '1px solid var(--glass-border-subtle)' }}>
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
