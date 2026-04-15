// src/components/search/CompareView.jsx
import React from 'react';
import toast from 'react-hot-toast';
import { useCompareStore } from '../../stores/compareStore';
import { useCartStore } from '../../stores/cartStore';
import { formatKES, formatRating } from '../../lib/format';
import { extractErrorMessage } from '../../lib/errors';

// All category-specific keys that appear across the selected products'
// `specs` objects, flattened into the attribute-comparison rows.
const collectSpecKeys = (items) => {
  const set = new Set();
  for (const r of items) {
    if (r.product.specs && typeof r.product.specs === 'object') {
      for (const key of Object.keys(r.product.specs)) set.add(key);
    }
  }
  return [...set];
};

// For each attribute, return the indices whose value is "best" (highlighted).
// rule: 'min' (lower wins), 'max' (higher wins), or 'none'.
const bestIndices = (values, rule) => {
  if (rule === 'none') return new Set();
  const numeric = values.map((v) => (typeof v === 'number' ? v : null));
  if (numeric.every((n) => n === null)) return new Set();
  const candidates = numeric.filter((n) => n !== null);
  const target = rule === 'min' ? Math.min(...candidates) : Math.max(...candidates);
  const out = new Set();
  numeric.forEach((n, i) => { if (n === target) out.add(i); });
  return out;
};

const CompareView = () => {
  const items = useCompareStore((s) => s.items);
  const close = useCompareStore((s) => s.closeView);
  const clear = useCompareStore((s) => s.clear);
  const remove = useCompareStore((s) => s.remove);
  const addToCart = useCartStore((s) => s.add);

  if (items.length === 0) return null;

  const specKeys = collectSpecKeys(items);

  const rows = [
    { label: 'Best price (KES)', rule: 'min',
      values: items.map((r) => r.min_price),
      render: (v) => formatKES(v) },
    { label: 'Cheapest at', rule: 'none',
      values: items.map((r) => r.best_merchant),
      render: (v) => v },
    { label: 'Merchants offering it', rule: 'max',
      values: items.map((r) => r.offer_count),
      render: (v) => String(v) },
    { label: 'Savings vs worst', rule: 'max',
      values: items.map((r) => r.max_price - r.min_price),
      render: (v) => formatKES(v) },
    { label: 'Size', rule: 'none',
      values: items.map((r) => r.product.size || '—'),
      render: (v) => v },
    { label: 'Rating', rule: 'max',
      values: items.map((r) => r.product.rating),
      render: (v) => (v == null ? '—' : formatRating(v)) },
    { label: 'Reviews', rule: 'max',
      values: items.map((r) => r.product.review_count),
      render: (v) => (v == null ? '—' : v.toLocaleString('en-KE')) },
    { label: 'Brand', rule: 'none',
      values: items.map((r) => r.product.brand || '—'),
      render: (v) => v },
    { label: 'Category', rule: 'none',
      values: items.map((r) => r.product.category || '—'),
      render: (v) => v },
    ...specKeys.map((key) => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      rule: 'none',
      values: items.map((r) => {
        const v = r.product.specs?.[key];
        if (v === true) return 'Yes';
        if (v === false) return 'No';
        return v == null ? '—' : String(v);
      }),
      render: (v) => v,
    })),
  ];

  const handleAddBest = async (r) => {
    const best = r.offers?.[0];
    if (!best?.merchant_id) {
      toast.error('Best offer is missing merchant id — refresh and retry.');
      return;
    }
    try {
      await addToCart({
        product_id: r.product.id,
        merchant_id: best.merchant_id,
        quantity: 1,
      });
      toast.success(`Added ${r.product.display_name} @ ${best.merchant}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not add to cart'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={close} />

      <div className="relative max-w-6xl mx-auto my-6 bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Compare {items.length} product{items.length === 1 ? '' : 's'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Best value per attribute is highlighted green.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clear}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              Clear all
            </button>
            <button
              onClick={close}
              className="bg-gray-100 hover:bg-gray-200 rounded-full p-2"
              aria-label="Close compare"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs uppercase tracking-wide text-gray-500 font-semibold px-3 py-2 bg-gray-50 w-40">
                  Attribute
                </th>
                {items.map((r) => (
                  <th
                    key={r.product.id}
                    className="text-left px-3 py-2 bg-gray-50 border-l border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-gray-900 font-semibold truncate">{r.product.display_name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[r.product.brand, r.product.category].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <button
                        onClick={() => remove(r.product.id)}
                        className="text-gray-400 hover:text-red-600 text-xs"
                        title="Remove from compare"
                      >
                        ✕
                      </button>
                    </div>
                    <button
                      onClick={() => handleAddBest(r)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      + Add cheapest
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const best = bestIndices(row.values, row.rule);
                return (
                  <tr key={row.label} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-700 bg-gray-50/50">
                      {row.label}
                    </td>
                    {row.values.map((v, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2 border-l border-gray-100 ${
                          best.has(i) ? 'bg-green-50 text-green-900 font-semibold' : 'text-gray-800'
                        }`}
                      >
                        {row.render(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CompareView;
