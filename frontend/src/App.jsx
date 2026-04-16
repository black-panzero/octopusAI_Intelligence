// src/App.jsx — Figma-matched layout: icon sidebar + green header + bottom nav.
// ALL existing logic preserved. Only the visual shell changed.
import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

// Views
import Dashboard from './components/Dashboard';
import SearchView from './components/search/SearchView';
import CartView from './components/cart/CartView';
import RulesView from './components/rules/RulesView';
import ChatView from './components/chat/ChatView';
import FloatingChatWidget from './components/chat/FloatingChatWidget';
import ShoppingListsView from './components/shoppingLists/ShoppingListsView';
import AdminView from './components/admin/AdminView';
import MerchantDashboard from './components/merchant/MerchantDashboard';
import AuthScreen from './components/auth/AuthScreen';

// Layout
import AppHeader from './components/layout/AppHeader';
import { GlassSidebar, GlassNav } from './components/ui';

// State
import { authApi, dealsApi } from './api';
import { useAuthStore } from './stores/authStore';
import { useCartStore } from './stores/cartStore';
import { useChatStore } from './stores/chatStore';

import './App.css';

const parseDealsResponse = (data) => {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.deals)) return data.deals;
  return Array.isArray(data) ? data : [];
};

// ── Nav icon SVGs (tiny, inline) ─────────────────────────────────────
const Icon = ({ d, ...p }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={d} />
  </svg>
);

const NAV_ICONS = {
  chat:     <Icon d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />,
  search:   <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  lists:    <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  cart:     <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2 6h14m-9 4a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />,
  tracking: <Icon d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
  wallet:   <Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  deals:    <Icon d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />,
  settings: <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
  admin:    <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
};

// ── Authenticated app ────────────────────────────────────────────────
function AuthenticatedApp({ user, onLogout }) {
  const userRole = user?.role || 'user';
  const defaultView = userRole === 'merchant' ? 'merchant' : userRole === 'admin' ? 'admin' : 'chat';
  const [currentView, setCurrentView] = useState(defaultView);
  const [allDeals, setAllDeals] = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cartItemCount = useCartStore((s) => s.cart.item_count);
  const refreshCart = useCartStore((s) => s.refresh);
  const resetCart = useCartStore((s) => s.reset);
  const resetChat = useChatStore((s) => s.reset);

  useEffect(() => { refreshCart(); }, [refreshCart]);
  useEffect(() => { if (currentView === 'cart') refreshCart(); }, [currentView, refreshCart]);
  useEffect(() => {
    if (currentView === 'deals' || currentView === 'dashboard') fetchAllDeals();
  }, [currentView]);

  const fetchAllDeals = async () => {
    try {
      setLoading(true); setError(null);
      const data = await dealsApi.getAllDeals({ page: 1, size: 20 });
      const arr = parseDealsResponse(data);
      setAllDeals(arr); setFilteredDeals(arr);
    } catch { setError('Failed to fetch deals.'); }
    finally { setLoading(false); }
  };

  const fetchDealsForFilters = async (params) => {
    try {
      setLoading(true); setError(null);
      return parseDealsResponse(await dealsApi.getAllDeals({ page: 1, size: 20, ...params }));
    } catch { setError('Failed to fetch deals.'); return []; }
    finally { setLoading(false); }
  };

  const handleCreateDeal = async (dealData) => {
    try {
      setLoading(true);
      const newDeal = await dealsApi.createDeal(dealData);
      const updated = [newDeal, ...allDeals];
      setAllDeals(updated); setFilteredDeals(updated);
      setShowAddForm(false); setCurrentView('deals');
      toast.success('Deal created!');
    } catch { toast.error('Failed to create deal.'); }
    finally { setLoading(false); }
  };

  const handleFiltersChange = async (filters) => {
    const bp = {};
    if (filters.merchant) bp.merchant = filters.merchant;
    if (filters.category) bp.category = filters.category;
    if (filters.isActive === 'true') bp.active_only = true;
    const wantsInactive = filters.isActive === 'false';
    if (wantsInactive) bp.include_expired = true;
    const fetched = await fetchDealsForFilters(bp);
    setAllDeals(fetched);
    let final = [...fetched];
    if (filters.search) {
      const t = filters.search.toLowerCase();
      final = final.filter((d) => d.product_name?.toLowerCase().includes(t) || d.description?.toLowerCase().includes(t));
    }
    if (filters.minPrice) { const m = parseFloat(filters.minPrice); if (!isNaN(m)) final = final.filter((d) => Number(d.price) >= m); }
    if (filters.maxPrice) { const m = parseFloat(filters.maxPrice); if (!isNaN(m)) final = final.filter((d) => Number(d.price) <= m); }
    if (wantsInactive) final = final.filter((d) => d.is_active === false);
    setFilteredDeals(final);
  };

  const handleNavigation = (view) => { setCurrentView(view); };
  const handleLogout = () => { resetCart(); resetChat(); onLogout(); };

  // Build nav items based on user role
  const navItems = userRole === 'merchant' ? [
    { key: 'merchant', label: 'Dashboard', icon: NAV_ICONS.deals },
    { key: 'chat',     label: 'Assistant', icon: NAV_ICONS.chat },
    { key: 'search',   label: 'Compare',   icon: NAV_ICONS.search },
    { key: 'settings', label: 'Settings',  icon: NAV_ICONS.settings },
  ] : userRole === 'admin' ? [
    { key: 'admin',    label: 'Admin',     icon: NAV_ICONS.admin },
    { key: 'chat',     label: 'Assistant', icon: NAV_ICONS.chat },
    { key: 'search',   label: 'Compare',   icon: NAV_ICONS.search },
    { key: 'cart',     label: 'Cart',      icon: NAV_ICONS.cart, count: cartItemCount },
    { key: 'lists',    label: 'Lists',     icon: NAV_ICONS.lists },
    { key: 'tracking', label: 'Watchlist',  icon: NAV_ICONS.tracking },
    { key: 'wallet',   label: 'Wallet',    icon: NAV_ICONS.wallet },
    { key: 'settings', label: 'Settings',  icon: NAV_ICONS.settings },
  ] : [
    // Standard user (shopper)
    { key: 'chat',     label: 'Assistant', icon: NAV_ICONS.chat },
    { key: 'search',   label: 'Compare',   icon: NAV_ICONS.search },
    { key: 'lists',    label: 'Lists',     icon: NAV_ICONS.lists },
    { key: 'cart',     label: 'Cart',      icon: NAV_ICONS.cart, count: cartItemCount },
    { key: 'tracking', label: 'Watchlist',  icon: NAV_ICONS.tracking },
    { key: 'wallet',   label: 'Wallet',    icon: NAV_ICONS.wallet },
    { key: 'settings', label: 'Settings',  icon: NAV_ICONS.settings },
  ];

  return (
    <div className="min-h-screen">
      {/* Green header */}
      <AppHeader user={user} onSearch={(q) => { setCurrentView('search'); }} onLogout={handleLogout} />

      {/* Desktop icon sidebar */}
      <GlassSidebar items={navItems} active={currentView} onNavigate={handleNavigation} onLogout={handleLogout} />

      {/* Mobile bottom nav (first 5 items) */}
      <GlassNav items={navItems.slice(0, 5)} active={currentView} onNavigate={handleNavigation} />

      {/* Main content area */}
      <main
        className="md:ml-[var(--sidebar-w)] pb-nav md:pb-0"
        style={{ paddingTop: 'var(--header-h)' }}
      >
        {/* Sub-header for Chat view — "Shopping Intelligence" */}
        {currentView === 'chat' && (
          <div className="glass-heavy glass-border-b px-4 md:px-6 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-[var(--text-lg)] font-bold" style={{ color: 'var(--text-primary)' }}>Shopping Intelligence</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[var(--text-xs)] font-medium" style={{ color: 'var(--text-tertiary)' }}>Find deals</span>
                <span className="text-[var(--text-xs)]" style={{ color: 'var(--text-tertiary)' }}>•</span>
                <span className="text-[var(--text-xs)] font-medium" style={{ color: 'var(--text-tertiary)' }}>Compare prices</span>
                <span className="text-[var(--text-xs)]" style={{ color: 'var(--text-tertiary)' }}>•</span>
                <span className="text-[var(--text-xs)] font-medium" style={{ color: 'var(--text-tertiary)' }}>Automate purchases</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => useChatStore.getState().newConversation()}
                className="glass-btn glass-btn-brand px-3 py-1.5 text-[var(--text-sm)]"
              >
                Recent
              </button>
              <button
                onClick={() => useChatStore.getState().newConversation()}
                className="glass-btn glass-btn-surface px-3 py-1.5 text-[var(--text-sm)]"
                style={{ color: 'var(--color-primary)' }}
              >
                + New
              </button>
            </div>
          </div>
        )}

        <div className="p-4 md:p-6">
          {currentView === 'dashboard' && <Dashboard deals={allDeals} onNavigate={handleNavigation} />}
          {currentView === 'chat' && <ChatView />}
          {currentView === 'search' && <SearchView />}
          {currentView === 'cart' && <CartView onNavigate={handleNavigation} />}
          {currentView === 'lists' && <ShoppingListsView onNavigate={handleNavigation} />}
          {currentView === 'tracking' && <RulesView onNavigate={handleNavigation} />}
          {currentView === 'wallet' && (
            <div className="glass-card p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
              <h2 className="text-[var(--text-2xl)] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Wallet</h2>
              <p>Wallet feature coming soon — manage funds, cashback, and referrals.</p>
            </div>
          )}
          {currentView === 'settings' && (
            <div className="glass-card p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
              <h2 className="text-[var(--text-2xl)] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Settings</h2>
              <p>Settings page coming soon — automation rules, preferences, notifications.</p>
            </div>
          )}
          {currentView === 'admin' && (userRole === 'admin' || user?.is_superuser) && <AdminView />}
          {currentView === 'merchant' && userRole === 'merchant' && <MerchantDashboard />}
        </div>
      </main>

      {/* Floating AI bubble — hidden on the Chat view */}
      <FloatingChatWidget hidden={currentView === 'chat'} />
    </div>
  );
}

// ── Root App ─────────────────────────────────────────────────────────
function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (token && !user) authApi.me().then(setUser).catch(() => logout());
  }, [token, user, setUser, logout]);

  return (
    <>
      {token ? <AuthenticatedApp user={user} onLogout={logout} /> : <AuthScreen />}
      <Toaster position="top-right" reverseOrder={false} />
    </>
  );
}

export default App;
