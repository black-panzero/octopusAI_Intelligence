// src/components/deals/DealDetails.jsx
import React from 'react';

const DealDetails = ({ deal, isOpen, onClose }) => {
  if (!isOpen || !deal) return null;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateSavings = () => {
    if (deal.original_price && deal.original_price > deal.price) {
      const savings = deal.original_price - deal.price;
      const percentage = ((savings / deal.original_price) * 100).toFixed(1);
      return { amount: savings, percentage };
    }
    return null;
  };

  const savings = calculateSavings();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 pt-6 pb-4 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
                  {deal.product_name}
                </h2>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    deal.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {deal.is_active ? 'Active Deal' : 'Inactive Deal'}
                  </span>
                  <span className="text-sm text-gray-500">
                    ID: {deal.id}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-4 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-6">
            {/* Price Information */}
            <div className="mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-baseline space-x-4 mb-2">
                  <span className="text-3xl font-bold text-blue-600">
                    {formatPrice(deal.price)}
                  </span>
                  {deal.original_price && deal.original_price > deal.price && (
                    <span className="text-lg text-gray-500 line-through">
                      {formatPrice(deal.original_price)}
                    </span>
                  )}
                </div>
                {savings && (
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-semibold text-green-600">
                      Save {formatPrice(savings.amount)}
                    </span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
                      {savings.percentage}% OFF
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Deal Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Merchant</h4>
                  <p className="text-lg font-semibold text-gray-900">{deal.merchant}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Category</h4>
                  <p className="text-lg font-semibold text-gray-900">{deal.category}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Date Added</h4>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDate(deal.date_added)}
                  </p>
                </div>
                {deal.deal_url && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Deal Link</h4>
                    <a 
                      href={deal.deal_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Original Deal
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {deal.description && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-800 leading-relaxed">
                    {deal.description}
                  </p>
                </div>
              </div>
            )}

            {/* Additional Information */}
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Additional Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Deal ID:</span>
                  <span className="font-medium text-gray-900">{deal.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${
                    deal.is_active ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {deal.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {deal.original_price && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Original Price:</span>
                      <span className="font-medium text-gray-900">
                        {formatPrice(deal.original_price)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Price:</span>
                      <span className="font-medium text-gray-900">
                        {formatPrice(deal.price)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Close
            </button>
            {deal.deal_url && (
              <a
                href={deal.deal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                View Deal
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealDetails;