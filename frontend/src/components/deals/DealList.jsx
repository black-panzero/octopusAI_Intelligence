// src/components/deals/DealList.jsx
import React from 'react';
import DealCard from './DealCard';

/**
 * Presentational list. State (fetch, filters) lives in App.jsx — this component
 * only renders what it's given. Fixes the bug where the list ignored parent props
 * and re-fetched, breaking filters + search + details modal.
 */
const DealList = ({ deals = [], loading = false, error = null, onDealSelect }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="glass-card p-6 animate-pulse">
            <div className="flex justify-between items-start mb-4">
              <div className="h-6 rounded w-3/4" style={{ background: 'var(--glass-bg-light)' }}></div>
              <div className="h-6 rounded w-16" style={{ background: 'var(--glass-bg-light)' }}></div>
            </div>
            <div className="mb-4">
              <div className="h-8 rounded w-1/2 mb-2" style={{ background: 'var(--glass-bg-light)' }}></div>
              <div className="h-4 rounded w-1/3" style={{ background: 'var(--glass-bg-light)' }}></div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 rounded w-full" style={{ background: 'var(--glass-bg-light)' }}></div>
              <div className="h-4 rounded w-full" style={{ background: 'var(--glass-bg-light)' }}></div>
            </div>
            <div className="h-4 rounded w-2/3 mb-4" style={{ background: 'var(--glass-bg-light)' }}></div>
            <div className="flex justify-between items-center pt-4">
              <div className="h-4 rounded w-1/4" style={{ background: 'var(--glass-bg-light)' }}></div>
              <div className="h-8 rounded w-24" style={{ background: 'var(--glass-bg-light)' }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="glass-card p-6 max-w-md mx-auto" style={{ background: 'var(--color-red-soft)' }}>
          <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full mb-4 badge-red">
            <svg className="w-6 h-6" style={{ color: 'var(--color-red)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-red)' }}>Error Loading Deals</h3>
          <p style={{ color: 'var(--color-red)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const dealArray = Array.isArray(deals) ? deals : [];

  if (dealArray.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="glass-card p-8 max-w-md mx-auto">
          <div className="flex items-center justify-center w-12 h-12 mx-auto glass-light rounded-full mb-4">
            <svg className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>No Deals Found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            No deals match your filters. Try clearing them or add a new deal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
          {dealArray.length} {dealArray.length === 1 ? 'Deal' : 'Deals'} Found
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dealArray.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onViewDetails={onDealSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default DealList;
