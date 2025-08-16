// src/components/deals/DealCard.jsx
import React from 'react';

const DealCard = ({ deal, onViewDetails }) => {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-200">
      {/* Deal Header */}
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

      {/* Price Information */}
      <div className="mb-4">
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-blue-600">
            {formatPrice(deal.price)}
          </span>
          {deal.original_price && deal.original_price > deal.price && (
            <>
              <span className="text-sm text-gray-500 line-through">
                {formatPrice(deal.original_price)}
              </span>
              <span className="text-sm font-medium text-green-600">
                Save {formatPrice(deal.original_price - deal.price)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Deal Details */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Merchant:</span>
          <span className="font-medium text-gray-900">{deal.merchant}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Category:</span>
          <span className="font-medium text-gray-900">{deal.category}</span>
        </div>
        {deal.deal_url && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Source:</span>
            <a 
              href={deal.deal_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              View Deal
            </a>
          </div>
        )}
      </div>

      {/* Description */}
      {deal.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
          {deal.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          Added: {formatDate(deal.date_added)}
        </span>
        <button
          onClick={() => onViewDetails(deal)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

export default DealCard;