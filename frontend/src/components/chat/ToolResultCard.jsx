// src/components/chat/ToolResultCard.jsx
// Renders a tool invocation from the chat API as an actionable widget.
import React from 'react';
import toast from 'react-hot-toast';
import { useCartStore } from '../../stores/cartStore';
import { formatKES, formatRating } from '../../lib/format';
import { extractErrorMessage } from '../../lib/errors';

const MerchantOfferRow = ({ offer, product, isBest }) => {
  const addToCart = useCartStore((s) => s.add);
  const [busy, setBusy] = React.useState(false);

  const handleAdd = async () => {
    if (!offer?.merchant_id) {
      toast.error('Offer missing merchant id — try asking the AI again.');
      return;
    }
    setBusy(true);
    try {
      await addToCart({
        product_id: product.id,
        merchant_id: offer.merchant_id,
        quantity: 1,
      });
      toast.success(`Added ${product.display_name} @ ${offer.merchant}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not add to cart'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center justify-between px-3 py-1.5 text-sm ${isBest ? 'bg-green-50' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-medium ${isBest ? 'text-green-900' : 'text-gray-900'}`}>{offer.merchant}</span>
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
          onClick={handleAdd}
          disabled={busy}
          className={`text-xs font-semibold px-2 py-1 rounded ${
            busy ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {busy ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
};

const SearchResults = ({ result }) => {
  const rows = result?.results || [];
  if (rows.length === 0) return null; // handled as prose in the chat bubble
  return (
    <div className="space-y-2">
      {rows.slice(0, 6).map((r) => (
        <div key={r.product.id} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {r.product.image_url ? (
                <img
                  src={r.product.image_url}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0 bg-gray-100"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{r.product.display_name}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {[r.product.brand, r.product.category, r.product.size].filter(Boolean).join(' • ')}
                  {r.product.rating != null && ` · ${formatRating(r.product.rating, r.product.review_count)}`}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-blue-600">{formatKES(r.min_price)}</p>
              {r.savings_pct > 0 && (
                <p className="text-[10px] text-green-700">-{r.savings_pct.toFixed(0)}%</p>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {r.offers.map((o, i) => (
              <MerchantOfferRow
                key={`${o.merchant}-${i}`}
                offer={o}
                product={r.product}
                isBest={o.price === r.min_price}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const CompareTable = ({ result }) => {
  const rows = result?.comparison || [];
  if (rows.length < 2) return null; // AI should say so in prose
  const allSpecKeys = new Set();
  rows.forEach((r) => {
    Object.keys(r.product?.specs || {}).forEach((k) => allSpecKeys.add(k));
  });

  const specEntries = [...allSpecKeys];
  const baseRows = [
    { label: 'Best price', render: (r) => formatKES(r.min_price) },
    { label: 'Cheapest at', render: (r) => r.best_merchant },
    { label: 'Size', render: (r) => r.product?.size || '—' },
    { label: 'Rating', render: (r) => (r.product?.rating != null ? formatRating(r.product.rating, r.product.review_count) : '—') },
    { label: 'Brand', render: (r) => r.product?.brand || '—' },
  ];

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-1.5 text-left text-gray-500 font-semibold">Attribute</th>
            {rows.map((r) => (
              <th key={r.product.id} className="px-2 py-1.5 text-left text-gray-900 font-semibold border-l border-gray-200">
                {r.product.display_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baseRows.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <td className="px-2 py-1.5 text-gray-600">{row.label}</td>
              {rows.map((r) => (
                <td key={r.product.id} className="px-2 py-1.5 text-gray-900 border-l border-gray-100">
                  {row.render(r)}
                </td>
              ))}
            </tr>
          ))}
          {specEntries.map((key) => (
            <tr key={key} className="border-t border-gray-100">
              <td className="px-2 py-1.5 text-gray-600 capitalize">{key.replace(/_/g, ' ')}</td>
              {rows.map((r) => {
                const v = r.product?.specs?.[key];
                const display = v === true ? 'Yes' : v === false ? 'No' : v == null ? '—' : String(v);
                return (
                  <td key={r.product.id} className="px-2 py-1.5 text-gray-900 border-l border-gray-100">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CartSummary = ({ result, title }) => {
  const cart = result?.cart || result;
  if (!cart || !cart.items) return null;
  return (
    <div className="border border-gray-200 rounded-lg bg-white p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900">{title || 'Cart'}</span>
        <span className="font-bold text-blue-600">{formatKES(cart.total)}</span>
      </div>
      {cart.items.length === 0 ? (
        <p className="text-xs text-gray-500">Empty.</p>
      ) : (
        <ul className="space-y-1">
          {cart.items.slice(0, 6).map((it) => (
            <li key={it.id} className="flex justify-between text-xs text-gray-700">
              <span className="truncate">
                {it.quantity}× {it.product_name}{' '}
                <span className="text-gray-400">@ {it.merchant}</span>
              </span>
              <span className="font-medium text-gray-900">{formatKES(it.subtotal)}</span>
            </li>
          ))}
        </ul>
      )}
      {cart.savings_vs_worst_split > 0 && (
        <p className="text-[11px] text-green-700 mt-2">
          Saving {formatKES(cart.savings_vs_worst_split)} vs worst-case split.
        </p>
      )}
    </div>
  );
};

const RulesList = ({ result }) => {
  const rules = result?.rules || [];
  if (rules.length === 0) return null;
  return (
    <ul className="space-y-1 border border-gray-200 rounded-lg bg-white p-2 text-xs">
      {rules.map((r) => (
        <li key={r.id} className={`flex justify-between px-1 py-0.5 ${r.triggered ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>
          <span className="truncate">{r.product_name} · {r.action}</span>
          <span>
            target {r.target_price != null ? formatKES(r.target_price) : '—'}
            {r.current_price != null && ` · now ${formatKES(r.current_price)}`}
          </span>
        </li>
      ))}
    </ul>
  );
};

const RefreshSummary = ({ result }) => {
  const per = result?.per_scraper || [];
  const total = result?.offers_persisted ?? 0;
  // Empty scrape = no widget, let the AI reply explain.
  if (per.length === 0 && total === 0) return null;
  return (
    <div className="border border-gray-200 rounded-lg bg-white p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900">
          Live refresh · {result?.query ? `"${result.query}"` : ''}
        </span>
        <span className={total > 0 ? 'text-green-700 font-medium' : 'text-gray-500'}>
          {total} new offer{total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {per.map((s) => (
          <span
            key={s.slug}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
              s.ok
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-500'
            }`}
            title={s.ok ? `${s.count} offers` : 'No offers returned'}
          >
            {s.slug}{s.ok ? ` · ${s.count}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

const ToolResultCard = ({ invocation }) => {
  const { tool, result } = invocation || {};
  if (!result) return null;
  if (result.error) {
    return (
      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
        {tool}: {result.error}
      </div>
    );
  }
  switch (tool) {
    case 'search_products':     return <SearchResults result={result} />;
    case 'compare_products':    return <CompareTable result={result} />;
    case 'add_to_cart':         return <CartSummary result={result} title="Added — current cart" />;
    case 'view_cart':           return <CartSummary result={result} />;
    case 'create_price_rule':
      return (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
          Rule #{result.rule_id} saved — target {formatKES(result.target_price)} · {result.action}
        </div>
      );
    case 'list_rules':          return <RulesList result={result} />;
    case 'refresh_live_prices': return <RefreshSummary result={result} />;
    default:
      // Never leak raw JSON — if we don't know the tool yet, render nothing
      // and let the assistant explain in prose.
      return null;
  }
};

export default ToolResultCard;
