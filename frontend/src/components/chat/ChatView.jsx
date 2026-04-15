// src/components/chat/ChatView.jsx
// Full-page Chat tab. All conversation state lives in the chat store so
// this view and the floating widget stay in sync.
import React from 'react';
import ChatPanel from './ChatPanel';

const ChatView = () => {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Chat with SmartBuy</h1>
        <p className="text-pink-100 text-sm">
          Ask for prices, comparisons, or tell it to add things to your cart.
          Everything you do here also happens in the rest of the app.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg h-[60vh] overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  );
};

export default ChatView;
