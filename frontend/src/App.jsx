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
import AuthScreen from './components/auth/AuthScreen';
import { authApi, dealsApi } from './api';
import { useAuthStore } from './stores/authStore';
import './App.css';

// Normalize different backend list-response shapes.
const parseDealsResponse = (data) => {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.deals)) return data.deals;
  return Array.isArray(data) ? data : [];
};

function AuthenticatedApp({ user, onLogout }) {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'deals' | 'add-deal'
  const [allDeals, setAllDeals] = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDealDetails, setShowDealDetails] = useState(false);

  useEffect(() => {
    if (currentView === 'deals' || currentView === 'dashboard') {
      fetchAllDeals();
    }
    // Search view manages its own data — no prefetch here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const fetchAllDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dealsApi.getAllDeals({ page: 1, size: 20 });
      const dealsArray = parseDealsResponse(data);
      setAllDeals(dealsArray);
      setFilteredDeals(dealsArray);
    } catch (err) {
      setError('Failed to fetch deals. Please check if the backend server is running.');
      console.error('Error fetching deals:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDealsForFilters = async (queryParams) => {
    try {
      setLoading(true);
      setError(null);
      const data = await dealsApi.getAllDeals({ page: 1, size: 20, ...queryParams });
      return parseDealsResponse(data);
    } catch (err) {
      setError('Failed to fetch deals. Please check if the backend server is running.');
      console.error('Error fetching deals (filters):', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeal = async (dealData) => {
    try {
      setLoading(true);
      const newDeal = await dealsApi.createDeal(dealData);
      if (!newDeal || typeof newDeal !== 'object') {
        throw new Error('Unexpected API payload for createDeal');
      }
      const updated = [newDeal, ...allDeals];
      setAllDeals(updated);
      setFilteredDeals(updated);
      setShowAddForm(false);
      setCurrentView('deals');
      toast.success('Deal created successfully!', { duration: 5000 });
    } catch (err) {
      console.error('Error creating deal:', err);
      toast.error('Failed to create deal. Please try again.');
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
        (deal) =>
          deal.product_name?.toLowerCase().includes(term) ||
          deal.description?.toLowerCase().includes(term),
      );
    }

    if (filters.minPrice) {
      const min = parseFloat(filters.minPrice);
      if (!Number.isNaN(min)) final = final.filter((deal) => Number(deal.price) >= min);
    }
    if (filters.maxPrice) {
      const max = parseFloat(filters.maxPrice);
      if (!Number.isNaN(max)) final = final.filter((deal) => Number(deal.price) <= max);
    }

    if (wantsInactiveOnly) final = final.filter((deal) => deal.is_active === false);

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

  const handleCloseAddForm = () => {
    setShowAddForm(false);
    setCurrentView('deals');
  };

  const handleCloseDealDetails = () => {
    setShowDealDetails(false);
    setSelectedDeal(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onAddDeal={handleAddDeal} user={user} onLogout={onLogout} />

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => handleNavigation('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentView === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleNavigation('search')}
              className={`relative py-4 px-1 border-b-2 font-medium text-sm ${
                currentView === 'search'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Compare Prices
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 uppercase tracking-wide">
                New
              </span>
            </button>
            <button
              onClick={() => handleNavigation('deals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentView === 'deals' || currentView === 'add-deal'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Deals ({allDeals.length})
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {currentView === 'dashboard' && (
            <Dashboard deals={allDeals} onNavigate={handleNavigation} />
          )}

          {currentView === 'search' && <SearchView />}

          {currentView === 'deals' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">All Deals</h1>
                <button
                  onClick={handleAddDeal}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                <button
                  onClick={handleCloseAddForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <DealForm
                  onSubmit={handleCreateDeal}
                  onCancel={handleCloseAddForm}
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
        onClose={handleCloseDealDetails}
      />

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  // If we have a token but no cached user (fresh reload), hydrate from /me.
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
