// src/components/deals/DealCard.jsx
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { rulesApi } from '../../api';
import { useCartStore } from '../../stores/cartStore';
import { formatKES, formatDate, computeDiscount } from '../../lib/format';

const DealCard = ({ deal, onViewDetails }) => {
  const { final, savings, percent } = computeDiscount(deal.price, deal.discount);
  const hasDiscount = savings > 0;

  const addToCart = useCartStore((s) => s.add);
  const [busy, setBusy] = useState(null);

  // Deals created after the unification carry product_id + merchant_id so
  // they plug into the same Cart / Track flows as catalog products.
  const linked = !!(deal.product_id && deal.merchant_id);

  const handleAdd = async () => {
    if (!linked) return;
    setBusy('cart');
    try {
      await addToCart({
        product_id: deal.product_id,
        merchant_id: deal.merchant_id,
        quantity: 1,
      });
      toast.success(`Added "${deal.product_name}" to cart`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not add to cart');
    } finally {
      setBusy(null);
    }
  };

  const handleTrack = async () => {
    if (!linked) return;
    setBusy('track');
    try {
      const target = Math.round((hasDiscount ? final : deal.price) * 0.95);
      await rulesApi.create({
        product_id: deal.product_id,
        action: 'alert',
        target_price: target,
      });
      toast.success(`Tracking "${deal.product_name}" @ target ${formatKES(target)}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not save rule');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass-card p-6 hover:shadow-lg transition-shadow duration-300">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold line-clamp-2" style={{ color: 'var(--text-primary)' }}>
          {deal.product_name}
        </h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          deal.is_active ? 'badge-green' : 'badge-red'
        }`}>
          {deal.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
          <span className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {formatKES(hasDiscount ? final : deal.price)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-sm line-through" style={{ color: 'var(--text-tertiary)' }}>
                {formatKES(deal.price)}
              </span>
              <span className="text-xs font-medium badge-green px-2 py-0.5 rounded-full">
                -{percent.toFixed(0)}%
              </span>
            </>
          )}
        </div>
        {hasDiscount && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-green)' }}>Save {formatKES(savings)}</p>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>Merchant:</span>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{deal.merchant}</span>
        </div>
        {deal.category && (
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Category:</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{deal.category}</span>
          </div>
        )}
        {deal.expiry && (
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Expires:</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatDate(deal.expiry)}</span>
          </div>
        )}
        {deal.original_url && (
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Source:</span>
            <a
              href={deal.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline truncate max-w-[140px]"
              style={{ color: 'var(--color-primary)' }}
            >
              View Deal
            </a>
          </div>
        )}
      </div>

      {deal.description && (
        <p className="text-sm mb-4 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{deal.description}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-4">
        <div className="glass-divider w-full mb-2" style={{ marginTop: '-1rem' }}></div>
        {linked && (
          <>
            <button
              onClick={handleAdd}
              disabled={busy === 'cart'}
              className={`glass-btn inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 ${
                busy === 'cart'
                  ? 'opacity-40 cursor-not-allowed glass-btn-ghost'
                  : 'glass-btn-primary'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-8M7 13l-2 6h14" />
              </svg>
              {busy === 'cart' ? 'Adding…' : 'Add to cart'}
            </button>
            <button
              onClick={handleTrack}
              disabled={busy === 'track'}
              className={`glass-btn inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 ${
                busy === 'track'
                  ? 'opacity-40 cursor-not-allowed glass-btn-ghost'
                  : 'glass-btn-brand'
              }`}
            >
              {busy === 'track' ? '…' : '★ Track'}
            </button>
          </>
        )}
        <button
          onClick={() => onViewDetails?.(deal)}
          className="glass-btn glass-btn-ghost ml-auto px-3 py-1.5 text-xs font-medium"
        >
          Details
        </button>
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>Added: {formatDate(deal.created_at)}</p>
    </div>
  );
};

export default DealCard;
