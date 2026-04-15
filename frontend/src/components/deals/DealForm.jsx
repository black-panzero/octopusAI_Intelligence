// src/components/deals/DealForm.jsx
import React, { useState } from 'react';
import { KENYA_MERCHANTS, DEAL_CATEGORIES } from '../../lib/format';

const DealForm = ({ onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    product_name: '',
    price: '',
    discount: '',
    merchant: '',
    category: '',
    description: '',
    original_url: '',
    expiry: '',
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const isValidUrl = (s) => {
    try { new URL(s); return true; } catch { return false; }
  };

  const validateForm = () => {
    const e = {};
    if (!formData.product_name.trim()) e.product_name = 'Product name is required';

    if (!formData.price) e.price = 'Price is required';
    else if (Number.isNaN(Number(formData.price)) || Number(formData.price) <= 0)
      e.price = 'Price must be a positive number';

    if (formData.discount !== '' && formData.discount !== null) {
      const d = Number(formData.discount);
      if (Number.isNaN(d) || d < 0) e.discount = 'Discount must be 0 or greater';
    }

    if (!formData.merchant.trim()) e.merchant = 'Merchant is required';

    if (formData.original_url && !isValidUrl(formData.original_url))
      e.original_url = 'Please enter a valid URL';

    if (formData.expiry) {
      const when = new Date(formData.expiry);
      if (Number.isNaN(when.getTime())) e.expiry = 'Invalid expiry date';
      else if (when < new Date()) e.expiry = 'Expiry must be in the future';
    }
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Build the payload that matches the backend schema exactly.
    const payload = {
      product_name: formData.product_name.trim(),
      price: Number(formData.price),
      merchant: formData.merchant.trim(),
    };
    if (formData.discount !== '') payload.discount = Number(formData.discount);
    if (formData.category) payload.category = formData.category;
    if (formData.description) payload.description = formData.description;
    if (formData.original_url) payload.original_url = formData.original_url;
    if (formData.expiry) payload.expiry = new Date(formData.expiry).toISOString();

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Name */}
      <div>
        <label htmlFor="product_name" className="block text-sm font-medium text-gray-700 mb-2">
          Product Name *
        </label>
        <input
          type="text"
          id="product_name"
          name="product_name"
          value={formData.product_name}
          onChange={handleInputChange}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.product_name ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
          }`}
          placeholder="e.g. Rice 5kg Pishori"
        />
        {errors.product_name && <p className="mt-1 text-sm text-red-600">{errors.product_name}</p>}
      </div>

      {/* Price + Discount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
            Price (KES) *
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            step="1"
            min="0"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.price ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="0"
          />
          {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
        </div>

        <div>
          <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-2">
            Discount (% or KES)
          </label>
          <input
            type="number"
            id="discount"
            name="discount"
            value={formData.discount}
            onChange={handleInputChange}
            step="0.1"
            min="0"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.discount ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="0 – 100 is treated as %"
          />
          {errors.discount && <p className="mt-1 text-sm text-red-600">{errors.discount}</p>}
        </div>
      </div>

      {/* Merchant + Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="merchant" className="block text-sm font-medium text-gray-700 mb-2">
            Merchant *
          </label>
          <select
            id="merchant"
            name="merchant"
            value={formData.merchant}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.merchant ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
          >
            <option value="">Select a merchant</option>
            {KENYA_MERCHANTS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {errors.merchant && <p className="mt-1 text-sm text-red-600">{errors.merchant}</p>}
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a category</option>
            {DEAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* URL + Expiry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="original_url" className="block text-sm font-medium text-gray-700 mb-2">
            Source URL
          </label>
          <input
            type="url"
            id="original_url"
            name="original_url"
            value={formData.original_url}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.original_url ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="https://naivas.online/product/..."
          />
          {errors.original_url && <p className="mt-1 text-sm text-red-600">{errors.original_url}</p>}
        </div>

        <div>
          <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-2">
            Expires
          </label>
          <input
            type="datetime-local"
            id="expiry"
            name="expiry"
            value={formData.expiry}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.expiry ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
          />
          {errors.expiry && <p className="mt-1 text-sm text-red-600">{errors.expiry}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Optional"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Creating…' : 'Create Deal'}
        </button>
      </div>
    </form>
  );
};

export default DealForm;
