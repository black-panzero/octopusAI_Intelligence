// src/components/chat/ChatView.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { chatApi } from '../../api';
import { extractErrorMessage } from '../../lib/errors';
import ToolResultCard from './ToolResultCard';

const SUGGESTIONS = [
  'Find the cheapest 5kg rice',
  'Compare Pishori Rice 5kg and Basmati Rice 2kg',
  'Add Brookside milk from the cheapest merchant to my cart',
  'Track Samsung Galaxy A15 and alert me under KES 22,000',
  'What is in my cart right now?',
];

const ChatView = () => {
  const [messages, setMessages] = useState([]);        // [{role, content, tool_calls?}...]
  const [invocationsByIdx, setInvocationsByIdx] = useState({}); // map msgIdx -> [inv]
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const scrollRef = useRef(null);

  useEffect(() => {
    chatApi.status().then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const data = await chatApi.send(next);
      setMessages(data.messages);
      // Map invocations to the assistant turn that triggered them (last one).
      if (Array.isArray(data.invocations) && data.invocations.length) {
        const lastAssistantIdx = data.messages
          .map((m, i) => ({ i, m }))
          .reverse()
          .find(({ m }) => m.role === 'assistant' && m.tool_calls)?.i;
        if (lastAssistantIdx != null) {
          setInvocationsByIdx((prev) => ({ ...prev, [lastAssistantIdx]: data.invocations }));
        }
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Chat failed'));
      // Re-allow retry by popping the optimistic user message
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send();
  };

  const canChat = status?.configured !== false;

  const renderableMessages = useMemo(
    () => messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && (m.content || m.tool_calls))),
    [messages],
  );

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Chat with SmartBuy</h1>
        <p className="text-pink-100 text-sm">
          Ask for prices, comparisons, or tell it to add things to your cart.
          Everything here also happens in the rest of the app.
        </p>
      </div>

      {status && !status.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
          <p className="font-semibold mb-1">AI not configured</p>
          <p>
            Set <code>LLM_API_KEY</code> (and optionally <code>LLM_PROVIDER</code>
            / <code>LLM_MODEL</code>) in <code>backend/.env</code> and restart
            uvicorn. Groq and OpenRouter both work out of the box.
          </p>
        </div>
      )}

      <div
        ref={scrollRef}
        className="bg-white border border-gray-200 rounded-lg h-[55vh] overflow-y-auto p-4 space-y-4"
      >
        {renderableMessages.length === 0 && (
          <div className="text-center text-gray-500 text-sm pt-12">
            <p className="mb-3">Try something:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!canChat}
                  className="text-xs bg-gray-100 hover:bg-fuchsia-100 hover:text-fuchsia-700 px-3 py-1 rounded-full disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {renderableMessages.map((m, idx) => {
          const realIdx = messages.indexOf(m);
          const invocations = invocationsByIdx[realIdx] || [];
          if (m.role === 'user') {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm">
                  {m.content}
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="flex justify-start">
              <div className="max-w-[90%] space-y-2">
                {m.content && (
                  <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2 text-sm whitespace-pre-wrap">
                    {m.content}
                  </div>
                )}
                {invocations.map((inv) => (
                  <div key={inv.id} className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-fuchsia-600 font-semibold">
                      Tool: {inv.tool}
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
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-gray-500 inline-flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-fuchsia-500" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={canChat ? 'Ask about prices, compare products, add to cart…' : 'Configure LLM_API_KEY to chat'}
          disabled={!canChat || loading}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={!canChat || loading || !input.trim()}
          className={`px-4 py-3 rounded-md font-medium text-white ${
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

export default ChatView;
