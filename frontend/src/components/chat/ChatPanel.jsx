// src/components/chat/ChatPanel.jsx
// Reusable chat body — messages + composer — shared by the full-page
// ChatView and the floating widget so they always show the same state.
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useChatStore } from '../../stores/chatStore';
import Markdown from './Markdown';
import ToolResultCard from './ToolResultCard';

const SUGGESTIONS = [
  'Find the cheapest 5kg rice',
  'Compare Pishori Rice 5kg and Basmati Rice 2kg',
  'Add Brookside milk from the cheapest merchant to my cart',
  'Track Samsung Galaxy A15 and alert me under KES 22,000',
  'What is in my cart right now?',
];

const ChatPanel = ({ compact = false }) => {
  const messages = useChatStore((s) => s.messages);
  const invocationsByIdx = useChatStore((s) => s.invocationsByIdx);
  const loading = useChatStore((s) => s.loading);
  const status = useChatStore((s) => s.status);
  const lastError = useChatStore((s) => s.lastError);
  const send = useChatStore((s) => s.send);
  const checkStatus = useChatStore((s) => s.checkStatus);

  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (status === null) checkStatus();
  }, [status, checkStatus]);

  useEffect(() => {
    if (lastError) toast.error(lastError);
  }, [lastError]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    await send(text);
  };

  const canChat = status?.configured !== false;

  const rendered = messages.filter(
    (m) => m.role === 'user' || (m.role === 'assistant' && (m.content || m.tool_calls)),
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {status && !status.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mx-3 mt-3">
          AI not configured. Set <code>LLM_API_KEY</code> in backend/.env and restart.
        </div>
      )}

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-3 space-y-3 ${compact ? 'text-sm' : ''}`}
      >
        {rendered.length === 0 && (
          <div className="text-center text-gray-500 text-xs pt-6">
            <p className="mb-2">Try:</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!canChat || loading}
                  className="text-[11px] bg-gray-100 hover:bg-fuchsia-100 hover:text-fuchsia-700 px-2.5 py-1 rounded-full disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {rendered.map((m) => {
          const realIdx = messages.indexOf(m);
          const invocations = invocationsByIdx[realIdx] || [];
          if (m.role === 'user') {
            return (
              <div key={realIdx} className="flex justify-end">
                <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-3 py-1.5 text-sm">
                  {m.content}
                </div>
              </div>
            );
          }
          return (
            <div key={realIdx} className="flex justify-start">
              <div className="max-w-[92%] space-y-1.5">
                {m.content && (
                  <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-3 py-1.5">
                    <Markdown>{m.content}</Markdown>
                  </div>
                )}
                {invocations.map((inv) => (
                  <div key={inv.id} className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-fuchsia-600 font-semibold">
                      {inv.tool}
                    </p>
                    <ToolResultCard invocation={inv} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-1.5 text-sm text-gray-500 inline-flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-fuchsia-500" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-2 flex gap-2 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={canChat ? 'Ask about prices, compare, add to cart…' : 'Configure LLM_API_KEY to chat'}
          disabled={!canChat || loading}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={!canChat || loading || !input.trim()}
          className={`px-3 py-2 rounded-md text-sm font-medium text-white ${
            !canChat || loading || !input.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-fuchsia-600 hover:bg-fuchsia-700'
          }`}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
