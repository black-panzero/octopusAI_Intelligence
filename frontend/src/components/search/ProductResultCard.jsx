// src/components/search/ProductResultCard.jsx
import React from 'react';
import { formatKES } from '../../lib/format';

const ProductResultCard = ({ result }) => {
  const { product, offers, min_price, max_price, best_merchant, savings_pct } = result;
  const hasSavings = savings_pct > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {product.display_name}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {[product.brand, product.category].filter(Boolean).join(' • ') || '—'}
          </p>
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

      <div className="divide-y divide-gray-100 border border-gray-100 rounded-md">
        {offers.map((offer, idx) => {
          const isBest = offer.price === min_price;
          return (
            <div
              key={`${offer.merchant_slug}-${idx}`}
              className={`flex items-center justify-between px-3 py-2 text-sm ${
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
                {!offer.available && (
                  <span className="text-[10px] uppercase tracking-wide bg-gray-200 text-gray-700 rounded px-1.5 py-0.5">
                    Out of stock
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`font-semibold ${isBest ? 'text-green-700' : 'text-gray-700'}`}>
                  {formatKES(offer.price)}
                </span>
                {offer.url && (
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Open →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductResultCard;
