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
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
          {deal.product_name}
        </h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          deal.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {deal.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
          <span className="text-2xl font-bold text-blue-600">
            {formatKES(hasDiscount ? final : deal.price)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-sm text-gray-500 line-through">
                {formatKES(deal.price)}
              </span>
              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                -{percent.toFixed(0)}%
              </span>
            </>
          )}
        </div>
        {hasDiscount && (
          <p className="text-xs text-green-700 mt-1">Save {formatKES(savings)}</p>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Merchant:</span>
          <span className="font-medium text-gray-900">{deal.merchant}</span>
        </div>
        {deal.category && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Category:</span>
            <span className="font-medium text-gray-900">{deal.category}</span>
          </div>
        )}
        {deal.expiry && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Expires:</span>
            <span className="font-medium text-gray-900">{formatDate(deal.expiry)}</span>
          </div>
        )}
        {deal.original_url && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Source:</span>
            <a
              href={deal.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline truncate max-w-[140px]"
            >
              View Deal
            </a>
          </div>
        )}
      </div>

      {deal.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{deal.description}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
        {linked && (
          <>
            <button
              onClick={handleAdd}
              disabled={busy === 'cart'}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md ${
                busy === 'cart'
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
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
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md ${
                busy === 'track'
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {busy === 'track' ? '…' : '★ Track'}
            </button>
          </>
        )}
        <button
          onClick={() => onViewDetails?.(deal)}
          className="ml-auto px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Details
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-3">Added: {formatDate(deal.created_at)}</p>
    </div>
  );
};

export default DealCard;
