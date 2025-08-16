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
  const [deals, setDeals] = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDealDetails, setShowDealDetails] = useState(false);

  // Load deals on component mount and when view changes to deals
  useEffect(() => {
    if (currentView === 'deals' || currentView === 'dashboard') {
      fetchAllDeals();
    }
  }, [currentView]);

  // Fetch all deals from API
  const fetchAllDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dealsApi.getAllDeals();
      setDeals(data);
      setFilteredDeals(data);
    } catch (err) {
      setError('Failed to fetch deals. Please check if the backend server is running.');
      console.error('Error fetching deals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeal = async (dealData) => {
    try {
      setLoading(true);

      const newDeal = await dealsApi.createDeal(dealData);

      // sanity check: make sure we actually got a deal-like object
      if (!newDeal || typeof newDeal !== 'object') {
        throw new Error('Unexpected API payload for createDeal');
      }

      // guard #1: deals must be an array
      const safeDeals = Array.isArray(deals) ? deals : [];
      const updatedDeals = [newDeal, ...safeDeals];

      setDeals(updatedDeals);

      // guard #2: setFilteredDeals must be callable
      if (typeof setFilteredDeals === 'function') {
        setFilteredDeals(updatedDeals);
      } else {
        console.warn('setFilteredDeals is not available; skipping filtered list update');
      }

      setShowAddForm(false);
      setCurrentView('deals');
      toast.success('Deal created successfully!', { duration: 5000 });
      //alert('Deal created successfully!');
    } catch (err) {
      console.error('Error creating deal:', err);
      alert('Failed to create deal. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  // Handle filters change
  const handleFiltersChange = (filters) => {
    let filtered = [...deals];

    // Apply search filter
    if (filters.search) {
      filtered = filtered.filter(deal =>
        deal.product_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        deal.description?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Apply merchant filter
    if (filters.merchant) {
      filtered = filtered.filter(deal => deal.merchant === filters.merchant);
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(deal => deal.category === filters.category);
    }

    // Apply price range filters
    if (filters.minPrice) {
      filtered = filtered.filter(deal => deal.price >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice) {
      filtered = filtered.filter(deal => deal.price <= parseFloat(filters.maxPrice));
    }

    // Apply status filter
    if (filters.isActive !== 'all') {
      filtered = filtered.filter(deal => deal.is_active === (filters.isActive === 'true'));
    }

    setFilteredDeals(filtered);
  };

  // Handle deal selection for details view
  const handleDealSelect = (deal) => {
    setSelectedDeal(deal);
    setShowDealDetails(true);
  };

  // Navigation handlers
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
              Deals ({deals.length})
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <Dashboard />
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

          {/* Add Deal Form View */}
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

      {/* Error Toast (Simple implementation) */}
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

      {/* ✅ React Hot Toast Toaster (must be here) */}
      <Toaster position="top-right" reverseOrder={false} />
      
    </div>
  );
}

export default App;