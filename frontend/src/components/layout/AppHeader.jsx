// Green gradient top header bar — brand + search + user menu with sign out.
import React, { useEffect, useRef, useState } from 'react';

const AppHeader = ({ user, onSearch, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) onSearch(searchQuery.trim());
  };

  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase();
  const roleBadge = user?.role === 'admin' ? 'Admin' : user?.role === 'merchant' ? 'Merchant' : null;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 md:left-[var(--sidebar-w)]"
      style={{ height: 'var(--header-h)' }}
    >
      <div className="h-full px-4 md:px-6 flex items-center gap-4"
           style={{ background: 'var(--brand-gradient)' }}>
        {/* Brand — mobile only */}
        <div className="flex items-center gap-2 md:hidden flex-shrink-0">
          <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
          </svg>
          <span className="text-white font-bold text-[var(--text-base)]">SmartBuy</span>
        </div>

        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <span className="text-white font-bold text-[var(--text-lg)]">Octopus SmartBuy</span>
          {roleBadge && (
            <span className="text-[10px] uppercase tracking-wider bg-white/20 text-white/90 px-2 py-0.5 rounded-full font-semibold">
              {roleBadge}
            </span>
          )}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-xl mx-auto flex items-center">
          <div className="relative w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deals, discounts, promotions, products..."
              className="w-full pl-10 pr-4 py-2 rounded-full bg-white/15 border border-white/20 text-white text-[var(--text-sm)] placeholder:text-white/40 focus:outline-none focus:bg-white/20 focus:border-white/30 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="ml-2 px-4 py-2 rounded-full bg-[var(--text-primary)] text-white text-[var(--text-sm)] font-semibold hover:bg-black transition-colors flex-shrink-0"
          >
            Search
          </button>
        </form>

        {/* Right — user menu with sign out */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors hidden md:flex">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* Avatar + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-[var(--text-sm)] hover:bg-white/30 transition-colors"
              title={user?.email}
            >
              {initial}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 glass-card p-0 overflow-hidden z-50" style={{ background: 'var(--glass-bg-solid)' }}>
                <div className="px-4 py-3 glass-border-b">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {user?.full_name || 'Account'}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{user?.email}</p>
                  {roleBadge && (
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-wider badge-blue px-2 py-0.5 rounded-full font-semibold">
                      {roleBadge}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setMenuOpen(false); onLogout?.(); }}
                  className="w-full text-left px-4 py-2.5 text-sm glass-hover transition-colors"
                  style={{ color: 'var(--color-red)' }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
