// src/App.jsx
import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import DealList from './components/deals/DealList';
import DealForm from './components/deals/DealForm';
import DealDetails from './components/deals/DealDetails';
import DealFilters from './components/deals/DealFilters';
import { dealsApi } from './api';
import './App.css';

function App() {
  // State management
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'deals', 'add-deal'

  // ✅ unchanged names, still drive Dashboard count + Deals view
  const [allDeals, setAllDeals] = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);

  const [selectedDeal, setSelectedDeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDealDetails, setShowDealDetails] = useState(false);

  // 🔧 small util to normalize API response shape
  // (some backends return { deals: [...] }, others { results: [...] })
  const parseDealsResponse = (data) => {
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.deals)) return data.deals;
    return Array.isArray(data) ? data : [];
  };

  // Load deals on component mount and when view changes
  useEffect(() => {
    if (currentView === 'deals' || currentView === 'dashboard') {
      fetchAllDeals(); // no filters by default
    }
  }, [currentView]);

  // ✅ unchanged public loader for initial pages (dashboard/deals)
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

  // ✨ NEW: a “raw” fetcher used by filters to avoid intermediate state flicker
  // It returns the fetched list without mutating filteredDeals mid-flight.
  const fetchDealsForFilters = async (queryParams) => {
    try {
      setLoading(true);
      setError(null);

      const data = await dealsApi.getAllDeals({
        page: 1,
        size: 20,
        ...queryParams,
      });
      return parseDealsResponse(data);
    } catch (err) {
      setError('Failed to fetch deals. Please check if the backend server is running.');
      console.error('Error fetching deals (filters):', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Handle create deal
  const handleCreateDeal = async (dealData) => {
    try {
      setLoading(true);

      const newDeal = await dealsApi.createDeal(dealData);

      if (!newDeal || typeof newDeal !== 'object') {
        throw new Error('Unexpected API payload for createDeal');
      }

      const updatedDeals = [newDeal, ...allDeals];
      setAllDeals(updatedDeals);
      setFilteredDeals(updatedDeals);

      setShowAddForm(false);
      setCurrentView('deals');
      toast.success('Deal created successfully!', { duration: 5000 });
    } catch (err) {
      console.error('Error creating deal:', err);
      alert('Failed to create deal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ✨ UPDATED: backend-powered filtering + local post-filters
  const handleFiltersChange = async (filters) => {
    // ----------------------------
    // Build backend params only for what the API supports
    // ----------------------------
    const backendParams = {};
    if (filters.merchant) backendParams.merchant = filters.merchant;
    if (filters.category) backendParams.category = filters.category;

    // ✅ Only send active_only when user selects "Active Only"
    //    (sending active_only=false means “no active filter”, not “inactive only”)
    if (filters.isActive === 'true') {
      backendParams.active_only = true;
    }

    // ✅ If user selects "Inactive Only", ask backend to also include expired items,
    //    then we’ll filter locally `is_active === false`
    const wantsInactiveOnly = filters.isActive === 'false';
    if (wantsInactiveOnly) {
      backendParams.include_expired = true;
    }

    // ----------------------------
    // Fetch using backend params
    // ----------------------------
    const fetched = await fetchDealsForFilters(backendParams);

    // Keep master list in sync for Dashboard and badge count
    setAllDeals(fetched);

    // ----------------------------
    // Apply local-only filters (search, min/max price, inactive-only)
    // ----------------------------
    let final = [...fetched];

    // Search (no backend param was provided in your spec)
    if (filters.search) {
      const term = filters.search.toLowerCase();
      final = final.filter(
        (deal) =>
          deal.product_name?.toLowerCase().includes(term) ||
          deal.description?.toLowerCase().includes(term)
      );
    }

    // Price range (no backend support in your spec)
    if (filters.minPrice) {
      const min = parseFloat(filters.minPrice);
      if (!Number.isNaN(min)) {
        final = final.filter((deal) => Number(deal.price) >= min);
      }
    }
    if (filters.maxPrice) {
      const max = parseFloat(filters.maxPrice);
      if (!Number.isNaN(max)) {
        final = final.filter((deal) => Number(deal.price) <= max);
      }
    }

    // Inactive only (no backend param in your spec)
    if (wantsInactiveOnly) {
      final = final.filter((deal) => deal.is_active === false);
    }

    setFilteredDeals(final);
  };

  // Handle deal selection
  const handleDealSelect = (deal) => {
    setSelectedDeal(deal);
    setShowDealDetails(true);
  };

  // Navigation
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
      {/* Header */}
      <Header onAddDeal={handleAddDeal} />

      {/* Navigation */}
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
              onClick={() => handleNavigation('deals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentView === 'deals' || currentView === 'add-deal'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {/* count from allDeals (unchanged) */}
              Deals ({allDeals.length})
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <Dashboard deals={allDeals} />
          )}

          {/* Deals View */}
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

              <DealFilters 
                onFiltersChange={handleFiltersChange}
                loading={loading}
              />

              <DealList
                deals={filteredDeals}
                loading={loading}
                error={error}
                onDealSelect={handleDealSelect}
              />
            </div>
          )}

          {/* Add Deal Form */}
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

      {/* Deal Details Modal */}
      <DealDetails
        deal={selectedDeal}
        isOpen={showDealDetails}
        onClose={handleCloseDealDetails}
      />

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-500 hover:text-red-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <Toaster position="top-right" reverseOrder={false} />
    </div>
  );
}

export default App;
