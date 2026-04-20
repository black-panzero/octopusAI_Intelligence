// src/components/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { dealsApi, recommendationsApi } from '../api';
import { useCartStore } from '../stores/cartStore';
import { formatKES, formatDate, computeDiscount, formatRating } from '../lib/format';
import { extractErrorMessage } from '../lib/errors';

const StatTile = ({ name, value, icon, color, description }) => {
  const badgeClass = {
    blue:   'badge-blue',
    green:  'badge-green',
    purple: 'badge-purple',
    orange: 'badge-amber',
  }[color] || 'badge-blue';
  return (
    <div className="glass-card p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{name}</p>
          <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
            {Number(value).toLocaleString('en-KE')}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
        </div>
        <div className={`p-3 rounded-full text-2xl ${badgeClass}`}>{icon}</div>
      </div>
    </div>
  );
};

const BestDealCard = ({ deal, onAdd }) => (
  <div className="glass-card p-3 hover:shadow-lg transition-shadow">
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{deal.product.display_name}</p>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
          {[deal.product.brand, deal.product.category, deal.product.size].filter(Boolean).join(' · ')}
        </p>
      </div>
      <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 badge-green font-semibold">
        -{deal.savings_pct.toFixed(0)}%
      </span>
    </div>
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{formatKES(deal.min_price)}</span>
      <span className="text-xs line-through" style={{ color: 'var(--text-tertiary)' }}>{formatKES(deal.max_price)}</span>
    </div>
    <p className="text-[11px] mb-2 truncate" style={{ color: 'var(--text-secondary)' }}>
      Cheapest at <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{deal.best_merchant}</span>
      {' · '}{deal.offer_count} merchants
    </p>
    <button
      onClick={() => onAdd?.(deal)}
      className="glass-btn glass-btn-primary w-full text-xs font-semibold px-2 py-1.5"
    >
      + Add cheapest
    </button>
  </div>
);

const PriceDropCard = ({ drop, onAdd }) => (
  <div className="glass-card p-3 hover:shadow-lg transition-shadow">
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{drop.product.display_name}</p>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
          {drop.merchant} · {formatDate(drop.observed_at)}
        </p>
      </div>
      <span className="text-[10px] uppercase tracking-wide badge-red rounded px-1.5 py-0.5 font-semibold">
        ↓ {drop.drop_pct.toFixed(0)}%
      </span>
    </div>
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-lg font-bold" style={{ color: 'var(--color-red)' }}>{formatKES(drop.current_price)}</span>
      <span className="text-xs line-through" style={{ color: 'var(--text-tertiary)' }}>{formatKES(drop.previous_price)}</span>
    </div>
    <button
      onClick={() => onAdd?.(drop)}
      className="glass-btn w-full text-xs font-semibold px-2 py-1.5 text-white"
      style={{ background: 'var(--color-red)' }}
    >
      + Add to cart
    </button>
  </div>
);

const TopRatedCard = ({ item, onAdd }) => (
  <div className="glass-card p-3 hover:shadow-lg transition-shadow">
    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{item.product.display_name}</p>
    <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
      {[item.product.brand, item.product.category].filter(Boolean).join(' · ')}
    </p>
    <p className="text-xs mt-1" style={{ color: 'var(--color-amber)' }}>
      {formatRating(item.product.rating, item.product.review_count)}
    </p>
    <div className="flex items-baseline justify-between mt-2">
      {item.min_price != null && <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{formatKES(item.min_price)}</span>}
      {item.merchant && <span className="text-[10px] truncate max-w-[100px]" style={{ color: 'var(--text-tertiary)' }}>@ {item.merchant}</span>}
    </div>
    {item.merchant_id && item.product?.id && (
      <button
        onClick={() => onAdd?.(item)}
        className="glass-btn mt-2 w-full text-xs font-semibold px-2 py-1.5 text-white"
        style={{ background: 'var(--color-amber)' }}
      >
        + Add
      </button>
    )}
  </div>
);

const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const addToCart = useCartStore((s) => s.add);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, r] = await Promise.all([
        dealsApi.getDealStats(),
        recommendationsApi.get().catch(() => null),
      ]);
      setStats(s);
      setRecs(r);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async (row) => {
    const product_id = row.product?.id;
    const merchant_id = row.merchant_id
      || (row.offers && row.offers[0]?.merchant_id);
    if (!product_id || !merchant_id) {
      toast.error('This recommendation is missing a merchant id — refresh.');
      return;
    }
    try {
      await addToCart({ product_id, merchant_id, quantity: 1 });
      toast.success(`Added ${row.product.display_name}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not add to cart'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <div className="animate-pulse">
                <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'var(--glass-bg-light)' }}></div>
                <div className="h-8 rounded w-1/2" style={{ background: 'var(--glass-bg-light)' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 flex items-center" style={{ background: 'var(--color-red-soft)', borderColor: 'var(--color-red)' }}>
        <div className="flex-1">
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-red)' }}>Error Loading Dashboard</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-red)' }}>{error}</p>
        </div>
        <button onClick={fetchAll} className="glass-btn glass-btn-ghost px-3 py-2 text-sm font-medium" style={{ color: 'var(--color-red)' }}>
          Retry
        </button>
      </div>
    );
  }

  const recent = Array.isArray(stats?.recent_deals) ? stats.recent_deals : [];
  const bestDeals = recs?.best_deals || [];
  const priceDrops = recs?.price_drops || [];
  const topRated = recs?.top_rated || [];

  const statCards = [
    { name: 'Total Deals',  value: stats?.total_deals       ?? 0, icon: '📦', color: 'blue',   description: 'All deals in system' },
    { name: 'Active Deals', value: stats?.active_deals      ?? 0, icon: '✅', color: 'green',  description: 'Currently available' },
    { name: 'Merchants',    value: stats?.unique_merchants  ?? 0, icon: '🏪', color: 'purple', description: 'Partner stores' },
    { name: 'Categories',   value: stats?.unique_categories ?? 0, icon: '📂', color: 'orange', description: 'Product types' },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 text-white" style={{ background: 'var(--brand-gradient)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold mb-2">Welcome to SmartBuy</h1>
            <p style={{ color: 'rgba(255,255,255,0.85)' }}>
              Compare deals across Kenyan merchants. Track prices. Save more.
            </p>
          </div>
          <button
            onClick={() => onNavigate?.('search')}
            className="glass-btn glass-btn-surface inline-flex items-center gap-2 font-semibold px-4 py-2"
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
        {statCards.map((s) => <StatTile key={s.name} {...s} />)}
      </div>

      {bestDeals.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>🔥 Best deals right now</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bestDeals.map((d) => (
              <BestDealCard key={d.product.id} deal={d} onAdd={handleAdd} />
            ))}
          </div>
        </section>
      )}

      {priceDrops.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>↓ Recent price drops</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {priceDrops.map((d, i) => (
              <PriceDropCard key={`${d.product.id}-${i}`} drop={d} onAdd={handleAdd} />
            ))}
          </div>
        </section>
      )}

      {topRated.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>⭐ Top-rated products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topRated.map((t) => (
              <TopRatedCard key={t.product.id} item={t} onAdd={handleAdd} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Deals</h2>
          <div className="space-y-3">
            {recent.slice(0, 5).map((deal) => {
              const { final, savings } = computeDiscount(deal.price, deal.discount);
              const show = savings > 0 ? final : deal.price;
              return (
                <div key={deal.id} className="flex items-center justify-between p-3 glass-light rounded-[var(--r-md)]">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{deal.product_name}</p>
                    <p className="text-sm truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {deal.merchant}{deal.category ? ` · ${deal.category}` : ''} · {formatDate(deal.created_at)}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>{formatKES(show)}</p>
                    <p className="text-xs" style={{ color: deal.is_active ? 'var(--color-green)' : 'var(--color-red)' }}>
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
