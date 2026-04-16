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
      <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading cart…</div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6 text-white" style={{ background: 'var(--brand-gradient)' }}>
          <h1 className="text-2xl font-bold mb-2">Your Universal Cart</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)' }}>
            Cross-merchant cart. Add the cheapest offer from any store — we'll
            total it up and show your savings.
          </p>
        </div>

        <div className="glass-card p-10 text-center" style={{ borderStyle: 'dashed' }}>
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>Your cart is empty.</p>
          <button
            onClick={() => onNavigate?.('search')}
            className="glass-btn glass-btn-primary inline-flex items-center gap-2 px-4 py-2"
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
      <div className="glass-card p-6 text-white" style={{ background: 'var(--brand-gradient)' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Your Universal Cart</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {cart.item_count} item{cart.item_count === 1 ? '' : 's'} across {cart.merchant_totals.length} merchant{cart.merchant_totals.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>Total</p>
            <p className="text-3xl font-bold">{formatKES(cart.total)}</p>
            {cart.savings_vs_worst_split > 0 && (
              <p className="text-xs mt-1" style={{ color: 'rgba(200,255,200,0.9)' }}>
                You saved {formatKES(cart.savings_vs_worst_split)} vs worst-case
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-card p-3 text-sm" style={{ background: 'var(--color-red-soft)', borderColor: 'var(--color-red)', color: 'var(--color-red)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {cart.items.map((item) => (
            <div
              key={item.id}
              className="glass-card p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.product_name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {[item.brand, item.category].filter(Boolean).join(' · ') || '—'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  From <span className="font-medium">{item.merchant}</span> @ {formatKES(item.price)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQty(item, -1)}
                  className="glass-btn glass-btn-ghost w-8 h-8"
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="min-w-[1.5rem] text-center font-medium">{item.quantity}</span>
                <button
                  onClick={() => handleQty(item, 1)}
                  className="glass-btn glass-btn-ghost w-8 h-8"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>

              <div className="text-right min-w-[90px]">
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatKES(item.subtotal)}</p>
                <button
                  onClick={() => remove(item.id)}
                  className="text-xs hover:underline" style={{ color: 'var(--color-red)' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={handleClear}
            className="text-sm hover:underline" style={{ color: 'var(--text-secondary)' }}
          >
            Empty cart
          </button>
        </div>

        <aside className="glass-card p-4 space-y-4 h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
            Per-merchant breakdown
          </h2>
          <div className="space-y-2">
            {cart.merchant_totals.map((m) => (
              <div key={m.merchant_slug || m.merchant} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>
                  {m.merchant} <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>({m.item_count})</span>
                </span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatKES(m.total)}</span>
              </div>
            ))}
          </div>

          <div className="glass-divider"></div>
          <div className="pt-1 flex justify-between items-center">
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Grand total</span>
            <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{formatKES(cart.total)}</span>
          </div>
          {cart.savings_vs_worst_split > 0 && (
            <div className="badge-green rounded-[var(--r-md)] p-2 text-xs">
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
