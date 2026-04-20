// src/components/chat/ChatView.jsx — Figma "Shopping Intelligence" chat.
// Full glass layout. Sidebar + intel panel handled by ChatPanel props.
import React from 'react';
import ChatPanel from './ChatPanel';

const ChatView = () => (
  <div className="glass-card overflow-hidden" style={{ height: 'calc(100vh - var(--header-h) - 100px)' }}>
    <ChatPanel showSidebar showIntelligence />
  </div>
);

export default ChatView;
