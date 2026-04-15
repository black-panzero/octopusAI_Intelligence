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
      className={`bg-white rounded-lg shadow-sm border p-5 transition-shadow hover:shadow-md ${
        compareSelected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {product.display_name}
          </h3>
          <p className="text-xs text-gray-500 truncate">{meta || '—'}</p>
          {product.rating != null && (
            <p className="text-xs text-amber-600 mt-1">
              {formatRating(product.rating, product.review_count)}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-blue-600">{formatKES(min_price)}</p>
          {hasSavings && (
            <p className="text-xs text-gray-500 line-through">{formatKES(max_price)}</p>
          )}
        </div>
      </div>

      {hasSavings && (
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-md px-2 py-1 text-xs font-medium mb-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
          Save {formatKES(max_price - min_price)} ({savings_pct.toFixed(0)}%) — cheapest at {best_merchant}
        </div>
      )}

      <div className="divide-y divide-gray-100 border border-gray-100 rounded-md mb-3">
        {offers.map((offer, idx) => {
          const isBest = offer.price === min_price;
          const isBusy = busyOffer === offer.merchant_slug;
          return (
            <div
              key={`${offer.merchant_slug}-${idx}`}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                isBest ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`font-medium ${isBest ? 'text-green-900' : 'text-gray-900'}`}>
                  {offer.merchant}
                </span>
                {isBest && (
                  <span className="text-[10px] uppercase tracking-wide bg-green-600 text-white rounded px-1.5 py-0.5">
                    Best
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`font-semibold ${isBest ? 'text-green-700' : 'text-gray-700'}`}>
                  {formatKES(offer.price)}
                </span>
                <button
                  onClick={() => handleAdd(offer)}
                  disabled={isBusy}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md ${
                    isBusy
                      ? 'bg-gray-200 text-gray-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
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
                    className="text-xs text-blue-600 hover:text-blue-800"
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
          className={`text-xs font-medium px-2 py-1 rounded-md border ${
            compareSelected
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {compareSelected ? '✓ Selected to compare' : '+ Compare'}
        </button>
        <button
          onClick={() => setTrackOpen((v) => !v)}
          className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
        >
          {trackOpen ? '✕ Cancel tracking' : '★ Track price'}
        </button>
      </div>

      {trackOpen && (
        <form onSubmit={handleTrack} className="mt-3 bg-emerald-50 border border-emerald-200 rounded-md p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-emerald-900">
              Target price (KES)
              <input
                type="number"
                min="0"
                step="1"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="mt-1 w-full px-2 py-1 border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="text-xs text-emerald-900">
              Action
              <select
                value={trackAction}
                onChange={(e) => setTrackAction(e.target.value)}
                className="mt-1 w-full px-2 py-1 border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="alert">Alert me</option>
                <option value="add_to_cart">Auto add to cart</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={tracking}
            className={`w-full text-sm font-medium py-2 rounded ${
              tracking ? 'bg-emerald-300 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'
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
