// src/App.jsx
import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import DealList from './components/deals/DealList';
import DealForm from './components/deals/DealForm';
import DealDetails from './components/deals/DealDetails';
import DealFilters from './components/deals/DealFilters';
import SearchView from './components/search/SearchView';
import CartView from './components/cart/CartView';
import RulesView from './components/rules/RulesView';
import ChatView from './components/chat/ChatView';
import FloatingChatWidget from './components/chat/FloatingChatWidget';
import AuthScreen from './components/auth/AuthScreen';
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

function AuthenticatedApp({ user, onLogout }) {
  const [currentView, setCurrentView] = useState('dashboard');
  const [allDeals, setAllDeals] = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDealDetails, setShowDealDetails] = useState(false);

  const cartItemCount = useCartStore((s) => s.cart.item_count);
  const refreshCart = useCartStore((s) => s.refresh);
  const resetCart = useCartStore((s) => s.reset);
  const resetChat = useChatStore((s) => s.reset);

  // Hydrate cart once on boot so the header badge is accurate.
  useEffect(() => { refreshCart(); }, [refreshCart]);

  // Refresh cart whenever the user enters the Cart view.
  useEffect(() => {
    if (currentView === 'cart') refreshCart();
  }, [currentView, refreshCart]);

  useEffect(() => {
    if (currentView === 'deals' || currentView === 'dashboard') fetchAllDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const fetchAllDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dealsApi.getAllDeals({ page: 1, size: 20 });
      const arr = parseDealsResponse(data);
      setAllDeals(arr);
      setFilteredDeals(arr);
    } catch (err) {
      setError('Failed to fetch deals. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDealsForFilters = async (params) => {
    try {
      setLoading(true);
      setError(null);
      const data = await dealsApi.getAllDeals({ page: 1, size: 20, ...params });
      return parseDealsResponse(data);
    } catch (err) {
      setError('Failed to fetch deals. Please check if the backend is running.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeal = async (dealData) => {
    try {
      setLoading(true);
      const newDeal = await dealsApi.createDeal(dealData);
      const updated = [newDeal, ...allDeals];
      setAllDeals(updated);
      setFilteredDeals(updated);
      setShowAddForm(false);
      setCurrentView('deals');
      toast.success('Deal created!');
    } catch (err) {
      toast.error('Failed to create deal.');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = async (filters) => {
    const backendParams = {};
    if (filters.merchant) backendParams.merchant = filters.merchant;
    if (filters.category) backendParams.category = filters.category;
    if (filters.isActive === 'true') backendParams.active_only = true;
    const wantsInactiveOnly = filters.isActive === 'false';
    if (wantsInactiveOnly) backendParams.include_expired = true;

    const fetched = await fetchDealsForFilters(backendParams);
    setAllDeals(fetched);

    let final = [...fetched];
    if (filters.search) {
      const term = filters.search.toLowerCase();
      final = final.filter(
        (d) => d.product_name?.toLowerCase().includes(term) ||
               d.description?.toLowerCase().includes(term),
      );
    }
    if (filters.minPrice) {
      const min = parseFloat(filters.minPrice);
      if (!Number.isNaN(min)) final = final.filter((d) => Number(d.price) >= min);
    }
    if (filters.maxPrice) {
      const max = parseFloat(filters.maxPrice);
      if (!Number.isNaN(max)) final = final.filter((d) => Number(d.price) <= max);
    }
    if (wantsInactiveOnly) final = final.filter((d) => d.is_active === false);
    setFilteredDeals(final);
  };

  const handleDealSelect = (deal) => {
    setSelectedDeal(deal);
    setShowDealDetails(true);
  };

  const handleNavigation = (view) => {
    setCurrentView(view);
    setShowAddForm(false);
    setShowDealDetails(false);
  };

  const handleAddDeal = () => {
    setShowAddForm(true);
    setCurrentView('add-deal');
  };

  const handleLogout = () => {
    resetCart();
    resetChat();
    onLogout();
  };

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'chat',      label: 'Chat AI', badge: 'NEW' },
    { key: 'search',    label: 'Compare Prices' },
    { key: 'cart',      label: 'Cart', count: cartItemCount },
    { key: 'tracking',  label: 'Tracking' },
    { key: 'deals',     label: `Deals (${allDeals.length})`, match: ['deals', 'add-deal'] },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onAddDeal={handleAddDeal}
        user={user}
        onLogout={handleLogout}
        cartCount={cartItemCount}
        onOpenCart={() => handleNavigation('cart')}
      />

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => {
              const active = tab.match
                ? tab.match.includes(currentView)
                : currentView === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleNavigation(tab.key)}
                  className={`relative py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    active
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 uppercase tracking-wide">
                      {tab.badge}
                    </span>
                  )}
                  {tab.count > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center text-[10px] font-semibold bg-blue-600 text-white rounded-full min-w-[18px] h-[18px] px-1">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {currentView === 'dashboard' && <Dashboard deals={allDeals} onNavigate={handleNavigation} />}
          {currentView === 'chat' && <ChatView />}
          {currentView === 'search' && <SearchView />}
          {currentView === 'cart' && <CartView onNavigate={handleNavigation} />}
          {currentView === 'tracking' && <RulesView onNavigate={handleNavigation} />}

          {currentView === 'deals' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">All Deals</h1>
                <button
                  onClick={handleAddDeal}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add New Deal
                </button>
              </div>
              <DealFilters onFiltersChange={handleFiltersChange} loading={loading} />
              <DealList
                deals={filteredDeals}
                loading={loading}
                error={error}
                onDealSelect={handleDealSelect}
              />
            </div>
          )}

          {currentView === 'add-deal' && showAddForm && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Add New Deal</h1>
                <button onClick={() => { setShowAddForm(false); setCurrentView('deals'); }}
                        className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <DealForm
                  onSubmit={handleCreateDeal}
                  onCancel={() => { setShowAddForm(false); setCurrentView('deals'); }}
                  isLoading={loading}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <DealDetails
        deal={selectedDeal}
        isOpen={showDealDetails}
        onClose={() => { setShowDealDetails(false); setSelectedDeal(null); }}
      />

      {error && currentView === 'deals' && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg">
          <div className="flex items-center">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
          </div>
        </div>
      )}

      {/* Floating AI assistant — hidden on the full Chat tab */}
      <FloatingChatWidget hidden={currentView === 'chat'} />
    </div>
  );
}

function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (token && !user) {
      authApi.me().then(setUser).catch(() => logout());
    }
  }, [token, user, setUser, logout]);

  return (
    <>
      {token
        ? <AuthenticatedApp user={user} onLogout={logout} />
        : <AuthScreen />}
      <Toaster position="top-right" reverseOrder={false} />
    </>
  );
}

export default App;
