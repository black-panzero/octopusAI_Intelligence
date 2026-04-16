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
    <div className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Filter Deals</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="col-span-full md:col-span-2">
          <label htmlFor="search" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
              className="glass-input w-full pl-10 pr-3 py-2"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="merchant" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Merchant
          </label>
          <select
            id="merchant"
            name="merchant"
            value={filters.merchant}
            onChange={handleInputChange}
            className="glass-input w-full px-3 py-2"
          >
            <option value="">All Merchants</option>
            {KENYA_MERCHANTS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Category
          </label>
          <select
            id="category"
            name="category"
            value={filters.category}
            onChange={handleInputChange}
            className="glass-input w-full px-3 py-2"
          >
            <option value="">All Categories</option>
            {DEAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="minPrice" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
            className="glass-input w-full px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="maxPrice" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
            className="glass-input w-full px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="isActive" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Status
          </label>
          <select
            id="isActive"
            name="isActive"
            value={filters.isActive}
            onChange={handleInputChange}
            className="glass-input w-full px-3 py-2"
          >
            <option value="all">All Deals</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="mt-4 pt-4">
          <div className="glass-divider mb-4"></div>
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
            <span className="ml-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Filtering deals…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealFilters;
