// src/components/chat/FloatingChatWidget.jsx
// Floating AI bubble → mini panel → full-screen transition using motion.
// Shares state with the Chat tab via the chatStore, so opening the widget
// on any page shows the same conversation.
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ChatPanel from './ChatPanel';
import { useChatStore } from '../../stores/chatStore';

const TRANSITION = { type: 'spring', damping: 28, stiffness: 240, mass: 0.9 };

// Shared container style pieces — motion animates between these via `layout`.
const MINI = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  width: 'min(380px, calc(100vw - 32px))',
  height: 'min(560px, calc(100vh - 48px))',
  borderRadius: 16,
};
const FULL = {
  position: 'fixed',
  top: 16,
  left: 16,
  right: 16,
  bottom: 16,
  width: 'auto',
  height: 'auto',
  borderRadius: 16,
};

const IconBubble = ({ onClick }) => (
  <motion.button
    key="fab"
    layoutId="chat-widget"
    onClick={onClick}
    aria-label="Open SmartBuy chat"
    className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center"
    style={{ background: 'var(--color-fuchsia)', boxShadow: '0 4px 16px rgba(217, 70, 239, 0.3)' }}
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    transition={TRANSITION}
  >
    {/* Sparkle + chat icon */}
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  </motion.button>
);

const PanelChrome = ({ mode, onMinimize, onToggleFull, onClose }) => (
  <div className="flex items-center justify-between px-3 py-2 text-white" style={{ background: 'var(--color-fuchsia)', borderRadius: '16px 16px 0 0' }}>
    <div className="flex items-center gap-2 min-w-0">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.8)' }} />
      <p className="text-sm font-semibold truncate">SmartBuy Assistant</p>
    </div>
    <div className="flex items-center gap-1">
      <button
        onClick={onToggleFull}
        title={mode === 'full' ? 'Minimize' : 'Expand'}
        className="p-1.5 rounded-[var(--r-md)] hover:bg-white/15 focus:outline-none"
      >
        {mode === 'full' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M9 15h6m-6 0v6m0-6l-6 6M15 9H9m6 0V3m0 6l6-6" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 8V4m0 0h4M4 4l5 5m11-5v4m0-4h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
        )}
      </button>
      <button
        onClick={onMinimize}
        title="Close"
        className="p-1.5 rounded-[var(--r-md)] hover:bg-white/15 focus:outline-none"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
);

const FloatingChatWidget = ({ hidden = false }) => {
  const [mode, setMode] = useState('closed'); // 'closed' | 'mini' | 'full'
  const checkStatus = useChatStore((s) => s.checkStatus);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // Hide entirely when consumer page doesn't want it (e.g. Chat tab).
  useEffect(() => {
    if (hidden && mode !== 'closed') setMode('closed');
  }, [hidden, mode]);

  // Escape key closes the panel.
  useEffect(() => {
    if (mode === 'closed') return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMode('closed'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  if (hidden) return null;

  return (
    <AnimatePresence initial={false}>
      {mode === 'closed' && <IconBubble key="fab" onClick={() => setMode('mini')} />}

      {mode === 'full' && (
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-40 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMode('mini')}
        />
      )}

      {mode !== 'closed' && (
        <motion.div
          key="panel"
          layoutId="chat-widget"
          role="dialog"
          aria-label="SmartBuy chat"
          className="z-50 glass-solid glass-border glass-shadow-lg overflow-hidden flex flex-col"
          style={mode === 'full' ? FULL : MINI}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={TRANSITION}
        >
          <PanelChrome
            mode={mode}
            onMinimize={() => setMode('closed')}
            onToggleFull={() => setMode(mode === 'full' ? 'mini' : 'full')}
            onClose={() => setMode('closed')}
          />
          <div className="flex-1 min-h-0">
            <ChatPanel
              compact={mode === 'mini'}
              showSidebar={mode === 'full'}
              showIntelligence={mode === 'full'}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingChatWidget;
