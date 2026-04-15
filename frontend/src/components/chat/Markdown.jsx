// src/components/chat/Markdown.jsx
// Thin wrapper around react-markdown with Tailwind-styled elements, used to
// render assistant replies. Intentionally opinionated: small table, compact
// bullet lists, inline code — nothing goes beyond the chat bubble.
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components = {
  p: ({ node, ...props }) => <p className="leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-0.5" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-0.5" {...props} />,
  li: ({ node, ...props }) => <li className="leading-snug" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  a: ({ node, ...props }) => (
    <a className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  code: ({ inline, children, ...props }) =>
    inline ? (
      <code className="bg-gray-200/70 px-1 py-0.5 rounded text-[0.85em] font-mono" {...props}>
        {children}
      </code>
    ) : (
      <pre className="bg-gray-900 text-gray-100 rounded-md p-3 overflow-x-auto text-xs my-2">
        <code {...props}>{children}</code>
      </pre>
    ),
  table: ({ node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full text-xs border border-gray-200 rounded" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-gray-50" {...props} />,
  th: ({ node, ...props }) => (
    <th className="px-2 py-1 text-left font-semibold text-gray-700 border-b border-gray-200" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="px-2 py-1 border-t border-gray-100 text-gray-800" {...props} />
  ),
  hr: () => <hr className="my-2 border-gray-200" />,
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-600 italic" {...props} />
  ),
};

const Markdown = ({ children }) => {
  if (!children) return null;
  return (
    <div className="space-y-2 text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {String(children)}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown;
