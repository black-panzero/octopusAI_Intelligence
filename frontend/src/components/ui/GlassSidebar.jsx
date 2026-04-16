// Desktop icon-only sidebar — matches the Figma narrow strip nav.
// Includes a sign-out button at the bottom.
import React from 'react';

const GlassSidebar = ({ items = [], active, onNavigate, onLogout }) => (
  <aside
    className="hidden md:flex flex-col items-center fixed left-0 top-0 bottom-0 z-40 glass-heavy glass-border-l py-4 gap-1"
    style={{ width: 'var(--sidebar-w)', borderLeft: 'none' }}
  >
    {/* Brand icon */}
    <button
      onClick={() => onNavigate(items[0]?.key || 'chat')}
      className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center mb-4 shadow-sm"
      style={{ background: 'var(--brand-gradient)' }}
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
                ? 'text-white shadow-sm'
                : 'hover:bg-[var(--glass-bg-light)]'
            }`}
            style={isActive
              ? { background: 'var(--color-primary)' }
              : { color: 'var(--text-tertiary)' }}
          >
            {item.icon}
            {item.count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5"
                    style={{ background: 'var(--color-red)' }}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>

    {/* Sign out at the bottom */}
    {onLogout && (
      <button
        onClick={onLogout}
        title="Sign out"
        className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center transition-all mt-2"
        style={{ color: 'var(--text-tertiary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-red)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    )}
  </aside>
);

export default GlassSidebar;
