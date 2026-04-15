// src/components/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { dealsApi } from '../api';
import { formatKES, formatDate, computeDiscount } from '../lib/format';

const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dealsApi.getDealStats();
      setStats(data);
    } catch (err) {
      setError('Failed to load dashboard statistics');
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Dashboard</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchStats}
            className="px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { name: 'Total Deals',   value: stats?.total_deals       ?? 0, icon: '📦', color: 'blue',   description: 'All deals in system' },
    { name: 'Active Deals',  value: stats?.active_deals      ?? 0, icon: '✅', color: 'green',  description: 'Currently available' },
    { name: 'Merchants',     value: stats?.unique_merchants  ?? 0, icon: '🏪', color: 'purple', description: 'Partner stores' },
    { name: 'Categories',    value: stats?.unique_categories ?? 0, icon: '📂', color: 'orange', description: 'Product types' },
  ];

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };

  const recent = Array.isArray(stats?.recent_deals) ? stats.recent_deals : [];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold mb-2">Welcome to SmartBuy</h1>
            <p className="text-blue-100">
              Compare deals across Kenyan merchants. Track prices. Save more.
            </p>
          </div>
          <button
            onClick={() => onNavigate?.('search')}
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-4 py-2 rounded-md shadow hover:bg-blue-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Compare Prices
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {Number(stat.value).toLocaleString('en-KE')}
                </p>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </div>
              <div className={`p-3 rounded-full text-2xl ${colorClasses[stat.color]}`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Deals</h2>
          <div className="space-y-3">
            {recent.slice(0, 5).map((deal) => {
              const { final, savings } = computeDiscount(deal.price, deal.discount);
              const show = savings > 0 ? final : deal.price;
              return (
                <div key={deal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{deal.product_name}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {deal.merchant}{deal.category ? ` • ${deal.category}` : ''} • {formatDate(deal.created_at)}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-blue-600">{formatKES(show)}</p>
                    <p className={`text-xs ${deal.is_active ? 'text-green-600' : 'text-red-600'}`}>
                      {deal.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
