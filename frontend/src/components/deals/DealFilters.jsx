// src/components/deals/DealFilters.jsx
import React, { useRef, useState } from 'react';
import { KENYA_MERCHANTS, DEAL_CATEGORIES } from '../../lib/format';

const DealFilters = ({ onFiltersChange, loading = false }) => {
  const [filters, setFilters] = useState({
    search: '',
    merchant: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    isActive: 'all',
  });

  // useRef replaces the fragile window.searchTimeout from before.
  const searchTimer = useRef(null);

  const emit = (next) => onFiltersChange?.(next);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const next = { ...filters, [name]: value };
    setFilters(next);

    if (name === 'search') {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => emit(next), 500);
    } else {
      emit(next);
    }
  };

  const handleClearFilters = () => {
    const cleared = {
      search: '', merchant: '', category: '',
      minPrice: '', maxPrice: '', isActive: 'all',
    };
    setFilters(cleared);
    emit(cleared);
  };

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== '' && v !== 'all',
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filter Deals</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="col-span-full md:col-span-2">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Products
          </label>
          <div className="relative">
            <input
              type="text"
              id="search"
              name="search"
              value={filters.search}
              onChange={handleInputChange}
              placeholder="Search by product name…"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="merchant" className="block text-sm font-medium text-gray-700 mb-2">
            Merchant
          </label>
          <select
            id="merchant"
            name="merchant"
            value={filters.merchant}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Merchants</option>
            {KENYA_MERCHANTS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            id="category"
            name="category"
            value={filters.category}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {DEAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="minPrice" className="block text-sm font-medium text-gray-700 mb-2">
            Min Price (KES)
          </label>
          <input
            type="number"
            id="minPrice"
            name="minPrice"
            value={filters.minPrice}
            onChange={handleInputChange}
            placeholder="0"
            min="0"
            step="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="maxPrice" className="block text-sm font-medium text-gray-700 mb-2">
            Max Price (KES)
          </label>
          <input
            type="number"
            id="maxPrice"
            name="maxPrice"
            value={filters.maxPrice}
            onChange={handleInputChange}
            placeholder="Any"
            min="0"
            step="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="isActive" className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            id="isActive"
            name="isActive"
            value={filters.isActive}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Deals</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Filtering deals…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealFilters;
