// src/components/chat/ChatView.jsx
// Full-page Chat tab. 3-column layout: conversations sidebar, messages,
// intelligence panel. All state lives in the chat store.
import React from 'react';
import ChatPanel from './ChatPanel';

const ChatView = () => {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Chat with SmartBuy</h1>
        <p className="text-pink-100 text-sm">
          Ask for prices, comparisons, or tell it to add things to your cart.
          Conversations are saved — pick one up again from the left.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg h-[70vh] overflow-hidden">
        <ChatPanel showSidebar showIntelligence />
      </div>
    </div>
  );
};

export default ChatView;
