// Desktop icon-only sidebar — matches the Figma narrow strip nav.
import React from 'react';

const GlassSidebar = ({ items = [], active, onNavigate }) => (
  <aside
    className="hidden md:flex flex-col items-center fixed left-0 top-0 bottom-0 z-40 glass-heavy glass-border-l py-4 gap-1"
    style={{ width: 'var(--sidebar-w)', borderLeft: 'none' }}
  >
    {/* Brand icon */}
    <button
      onClick={() => onNavigate('chat')}
      className="w-10 h-10 rounded-[var(--r-md)] bg-[var(--brand-green)] flex items-center justify-center mb-4 shadow-sm"
    >
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    </button>

    <div className="flex-1 flex flex-col items-center gap-1">
      {items.map((item) => {
        const isActive = item.match
          ? item.match.includes(active)
          : active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            title={item.label}
            className={`relative w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center transition-all ${
              isActive
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--glass-bg-light)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {item.icon}
            {item.count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-[var(--color-red)] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>

    {/* Bottom icons: settings, etc handled via items */}
  </aside>
);

export default GlassSidebar;
