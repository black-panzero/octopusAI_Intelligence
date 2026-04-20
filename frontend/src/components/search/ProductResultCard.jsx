// src/components/search/ProductResultCard.jsx
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { rulesApi } from '../../api';
import { useCartStore } from '../../stores/cartStore';
import { useCompareStore } from '../../stores/compareStore';
import { formatKES, formatRating } from '../../lib/format';
import { extractErrorMessage } from '../../lib/errors';

const ProductResultCard = ({ result }) => {
  const { product, offers, min_price, max_price, best_merchant, savings_pct } = result;
  const hasSavings = savings_pct > 0;
  const addToCart = useCartStore((s) => s.add);

  const toggleCompare = useCompareStore((s) => s.toggle);
  const compareSelected = useCompareStore((s) =>
    s.items.some((r) => r.product.id === product.id),
  );
  const compareCount = useCompareStore((s) => s.items.length);
  const compareMax = useCompareStore((s) => s.max);

  const [busyOffer, setBusyOffer] = useState(null);
  const [trackOpen, setTrackOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState(String(Math.round(min_price * 0.95)));
  const [trackAction, setTrackAction] = useState('alert');
  const [tracking, setTracking] = useState(false);

  const handleAdd = async (offer) => {
    if (!offer?.merchant_id) {
      toast.error('This offer is missing a merchant id — refresh the page.');
      return;
    }
    setBusyOffer(offer.merchant_slug);
    try {
      await addToCart({
        product_id: product.id,
        merchant_id: offer.merchant_id,
        quantity: 1,
      });
      toast.success(`Added "${product.display_name}" from ${offer.merchant}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not add to cart'));
    } finally {
      setBusyOffer(null);
    }
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    setTracking(true);
    try {
      const parsed = targetPrice === '' ? null : Number(targetPrice);
      await rulesApi.create({
        product_id: product.id,
        action: trackAction,
        target_price: Number.isFinite(parsed) ? parsed : null,
      });
      toast.success('Rule saved — open the Tracking tab to manage');
      setTrackOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not save rule'));
    } finally {
      setTracking(false);
    }
  };

  const handleCompare = () => {
    if (!compareSelected && compareCount >= compareMax) {
      toast.error(`You can compare up to ${compareMax} products at a time`);
      return;
    }
    toggleCompare(result);
  };

  const meta = [
    product.brand,
    product.category,
    product.size && `· ${product.size}`,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`glass-card p-5 transition-shadow hover:shadow-lg ${
        compareSelected ? 'ring-2' : ''
      }`}
      style={compareSelected ? { borderColor: 'var(--color-purple)', boxShadow: '0 0 0 2px var(--color-purple-soft)' } : {}}
    >
      <div className="flex items-start gap-4 mb-3">
        {/* Product thumbnail with a graceful placeholder */}
        {product.image_url ? (
          <img
            src={product.image_url}
            alt=""
            loading="lazy"
            className="w-16 h-16 rounded-[var(--r-md)] object-cover glass-light flex-shrink-0 glass-border"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
        ) : (
          <div className="w-16 h-16 rounded-[var(--r-md)] glass-light flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                {product.display_name}
              </h3>
              <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{meta || '—'}</p>
              {product.rating != null && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-amber)' }}>
                  {formatRating(product.rating, product.review_count)}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{formatKES(min_price)}</p>
              {hasSavings && (
                <p className="text-xs line-through" style={{ color: 'var(--text-tertiary)' }}>{formatKES(max_price)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {hasSavings && (
        <div className="inline-flex items-center gap-2 badge-green rounded-[var(--r-md)] px-2 py-1 text-xs font-medium mb-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-green)' }} />
          Save {formatKES(max_price - min_price)} ({savings_pct.toFixed(0)}%) — cheapest at {best_merchant}
        </div>
      )}

      <div className="glass-border rounded-[var(--r-md)] mb-3 overflow-hidden">
        {offers.map((offer, idx) => {
          const isBest = offer.price === min_price;
          const isBusy = busyOffer === offer.merchant_slug;
          return (
            <div
              key={`${offer.merchant_slug}-${idx}`}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                idx > 0 ? 'glass-border-t' : ''
              }`}
              style={isBest ? { background: 'var(--color-green-soft)' } : {}}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium" style={{ color: isBest ? 'var(--color-green)' : 'var(--text-primary)' }}>
                  {offer.merchant}
                </span>
                {isBest && (
                  <span className="text-[10px] uppercase tracking-wide badge-green rounded px-1.5 py-0.5 font-semibold">
                    Best
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-semibold" style={{ color: isBest ? 'var(--color-green)' : 'var(--text-secondary)' }}>
                  {formatKES(offer.price)}
                </span>
                <button
                  onClick={() => handleAdd(offer)}
                  disabled={isBusy}
                  className={`glass-btn inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 ${
                    isBusy
                      ? 'opacity-40 cursor-not-allowed glass-btn-ghost'
                      : 'glass-btn-primary'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-8M7 13l-2 6h14" />
                  </svg>
                  {isBusy ? 'Adding…' : 'Add to cart'}
                </button>
                {offer.url && (
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs"
                    style={{ color: 'var(--color-primary)' }}
                    title="Open merchant page"
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handleCompare}
          className={`glass-btn text-xs font-medium px-2 py-1 ${
            compareSelected
              ? 'badge-purple glass-border'
              : 'glass-btn-ghost'
          }`}
        >
          {compareSelected ? '✓ Selected to compare' : '+ Compare'}
        </button>
        <button
          onClick={() => setTrackOpen((v) => !v)}
          className="text-xs font-medium" style={{ color: 'var(--color-green)' }}
        >
          {trackOpen ? '✕ Cancel tracking' : '★ Track price'}
        </button>
      </div>

      {trackOpen && (
        <form onSubmit={handleTrack} className="mt-3 glass-card p-3 space-y-2" style={{ background: 'var(--color-green-soft)' }}>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs" style={{ color: 'var(--color-green)' }}>
              Target price (KES)
              <input
                type="number"
                min="0"
                step="1"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="glass-input mt-1 w-full px-2 py-1"
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--color-green)' }}>
              Action
              <select
                value={trackAction}
                onChange={(e) => setTrackAction(e.target.value)}
                className="glass-input mt-1 w-full px-2 py-1"
              >
                <option value="alert">Alert me</option>
                <option value="add_to_cart">Auto add to cart</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={tracking}
            className={`glass-btn w-full text-sm font-medium py-2 ${
              tracking ? 'opacity-40 cursor-not-allowed glass-btn-ghost' : 'glass-btn-brand'
            }`}
          >
            {tracking ? 'Saving…' : 'Save rule'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ProductResultCard;
