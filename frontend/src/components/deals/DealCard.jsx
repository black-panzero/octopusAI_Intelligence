// src/components/deals/DealCard.jsx
import React from 'react';
import { formatKES, formatDate, computeDiscount } from '../../lib/format';

const DealCard = ({ deal, onViewDetails }) => {
  const { final, savings, percent } = computeDiscount(deal.price, deal.discount);
  const hasDiscount = savings > 0;

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
          <p className="text-xs text-green-700 mt-1">
            Save {formatKES(savings)}
          </p>
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
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
          {deal.description}
        </p>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          Added: {formatDate(deal.created_at)}
        </span>
        <button
          onClick={() => onViewDetails?.(deal)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

export default DealCard;
