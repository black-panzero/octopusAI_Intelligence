// Bottom navigation bar — mobile-first, frosted glass.
import React from 'react';

const GlassNav = ({ items = [], active, onNavigate }) => (
  <nav className="fixed bottom-0 inset-x-0 z-50 glass-heavy glass-border-t md:hidden"
       style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
    <div className="flex items-stretch justify-around" style={{ height: 'var(--nav-h)' }}>
      {items.map((item) => {
        const isActive = item.match
          ? item.match.includes(active)
          : active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <div className="relative">
              {item.icon}
              {item.count > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] bg-[var(--color-red)] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {item.count}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

export default GlassNav;
