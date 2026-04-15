// src/components/cart/CartView.jsx
import React, { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useCartStore } from '../../stores/cartStore';
import { formatKES } from '../../lib/format';

const CartView = ({ onNavigate }) => {
  const cart = useCartStore((s) => s.cart);
  const loading = useCartStore((s) => s.loading);
  const error = useCartStore((s) => s.error);
  const refresh = useCartStore((s) => s.refresh);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);

  useEffect(() => { refresh(); }, [refresh]);

  const handleQty = (item, delta) => {
    const next = item.quantity + delta;
    updateQuantity(item.id, next);
  };

  const handleClear = async () => {
    await clear();
    toast.success('Cart cleared');
  };

  if (loading && cart.items.length === 0) {
    return (
      <div className="text-gray-500 text-sm">Loading cart…</div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Your Universal Cart</h1>
          <p className="text-indigo-100">
            Cross-merchant cart. Add the cheapest offer from any store — we'll
            total it up and show your savings.
          </p>
        </div>

        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
          <p className="text-gray-600 mb-4">Your cart is empty.</p>
          <button
            onClick={() => onNavigate?.('search')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Start comparing prices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Your Universal Cart</h1>
            <p className="text-indigo-100 text-sm">
              {cart.item_count} item{cart.item_count === 1 ? '' : 's'} across {cart.merchant_totals.length} merchant{cart.merchant_totals.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-indigo-200">Total</p>
            <p className="text-3xl font-bold">{formatKES(cart.total)}</p>
            {cart.savings_vs_worst_split > 0 && (
              <p className="text-xs mt-1 text-green-200">
                You saved {formatKES(cart.savings_vs_worst_split)} vs worst-case
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {cart.items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {[item.brand, item.category].filter(Boolean).join(' • ') || '—'}
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  From <span className="font-medium">{item.merchant}</span> @ {formatKES(item.price)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQty(item, -1)}
                  className="w-8 h-8 rounded-md border border-gray-300 hover:bg-gray-50"
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="min-w-[1.5rem] text-center font-medium">{item.quantity}</span>
                <button
                  onClick={() => handleQty(item, 1)}
                  className="w-8 h-8 rounded-md border border-gray-300 hover:bg-gray-50"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>

              <div className="text-right min-w-[90px]">
                <p className="font-semibold text-gray-900">{formatKES(item.subtotal)}</p>
                <button
                  onClick={() => remove(item.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={handleClear}
            className="text-sm text-gray-600 hover:text-red-600"
          >
            Empty cart
          </button>
        </div>

        <aside className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Per-merchant breakdown
          </h2>
          <div className="space-y-2">
            {cart.merchant_totals.map((m) => (
              <div key={m.merchant_slug || m.merchant} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {m.merchant} <span className="text-gray-400 text-xs">({m.item_count})</span>
                </span>
                <span className="font-semibold text-gray-900">{formatKES(m.total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
            <span className="font-medium text-gray-900">Grand total</span>
            <span className="text-lg font-bold text-blue-600">{formatKES(cart.total)}</span>
          </div>
          {cart.savings_vs_worst_split > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-800">
              Picking the cheapest offer per item saves you{' '}
              <span className="font-semibold">{formatKES(cart.savings_vs_worst_split)}</span>
              {' '}vs. worst-case single-merchant.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default CartView;
