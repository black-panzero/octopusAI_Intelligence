// src/components/chat/IntelligencePanel.jsx
// Right-side "conversation intelligence" — a calm Apple-style summary panel
// that surfaces the entities the user has touched in this chat:
// products explored, cart items, tracking rules, merchants seen, and a
// shortlist (shopping list). Collapsed by default; expand for the full view.
import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useChatStore } from '../../stores/chatStore';
import { useCartStore } from '../../stores/cartStore';
import { formatKES, formatRating } from '../../lib/format';

const deriveIntel = (messages, invocationsByIdx) => {
  const products = new Map();      // id -> product
  const merchants = new Map();     // name -> { name, count, best_price }
  const cartById = new Map();      // item.id -> item
  const rulesById = new Map();     // rule.id -> rule
  const lastCartTotal = { total: 0, savings: 0 };
  const priceDrops = [];           // from price drop invocations (unused for now)

  const noteProduct = (p) => { if (p && p.id != null) products.set(p.id, p); };
  const noteMerchant = (name, offer) => {
    if (!name) return;
    const prev = merchants.get(name) || { name, count: 0, min_price: Infinity };
    prev.count += 1;
    if (offer && offer.price != null && offer.price < prev.min_price) {
      prev.min_price = offer.price;
    }
    merchants.set(name, prev);
  };

  const invs = Object.values(invocationsByIdx || {}).flat();
  for (const inv of invs) {
    const r = inv?.result || {};
    switch (inv?.tool) {
      case 'search_products': {
        (r.results || []).forEach((row) => {
          noteProduct(row.product);
          (row.offers || []).forEach((o) => noteMerchant(o.merchant, o));
        });
        break;
      }
      case 'compare_products': {
        (r.comparison || []).forEach((row) => {
          noteProduct(row.product);
          (row.offers || []).forEach((o) => noteMerchant(o.merchant, o));
        });
        break;
      }
      case 'add_to_cart':
      case 'view_cart': {
        const cart = r.cart || r;
        (cart?.items || []).forEach((it) => cartById.set(it.id, it));
        if (typeof cart?.total === 'number') lastCartTotal.total = cart.total;
        if (typeof cart?.savings_vs_worst_split === 'number') {
          lastCartTotal.savings = cart.savings_vs_worst_split;
        }
        break;
      }
      case 'list_rules': {
        (r.rules || []).forEach((ru) => rulesById.set(ru.id, ru));
        break;
      }
      case 'create_price_rule': {
        if (r.rule_id) {
          rulesById.set(r.rule_id, {
            id: r.rule_id,
            product_name: undefined,
            action: r.action,
            target_price: r.target_price,
          });
        }
        break;
      }
      default: break;
    }
  }

  return {
    products: [...products.values()],
    merchants: [...merchants.values()]
      .map((m) => ({ ...m, min_price: m.min_price === Infinity ? null : m.min_price })),
    cartItems: [...cartById.values()],
    rules: [...rulesById.values()],
    cartTotal: lastCartTotal.total,
    cartSavings: lastCartTotal.savings,
  };
};

const Disclosure = ({ icon, title, count, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-gray-50 focus:outline-none"
      >
        <span className="flex items-center gap-2 text-sm text-gray-800">
          <span className="text-base">{icon}</span>
          <span className="font-medium">{title}</span>
          {count != null && (
            <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
              {count}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transform transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 text-sm">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProductRow = ({ product }) => (
  <div className="flex items-center gap-2 py-1">
    {product.image_url ? (
      <img src={product.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 bg-gray-100"
           onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
    ) : (
      <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-900 truncate">{product.display_name}</p>
      <p className="text-[11px] text-gray-500 truncate">
        {[product.brand, product.category, product.size].filter(Boolean).join(' • ')}
        {product.rating != null && ` · ${formatRating(product.rating, product.review_count)}`}
      </p>
    </div>
  </div>
);

const IntelligencePanel = ({ collapsed, onToggle }) => {
  const messages = useChatStore((s) => s.messages);
  const invByIdx = useChatStore((s) => s.invocationsByIdx);
  const liveCart = useCartStore((s) => s.cart);

  const intel = useMemo(() => deriveIntel(messages, invByIdx), [messages, invByIdx]);

  const summary = [
    intel.products.length && `${intel.products.length} explored`,
    (intel.cartItems.length || liveCart?.item_count)
      && `${intel.cartItems.length || liveCart.item_count} in cart`,
    intel.rules.length && `${intel.rules.length} tracked`,
    intel.merchants.length && `${intel.merchants.length} merchants`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide font-semibold text-gray-500">Intelligence</p>
          {summary && <p className="text-[11px] text-gray-500 truncate">{summary}</p>}
        </div>
        <button
          onClick={onToggle}
          className="text-xs text-gray-500 hover:text-gray-800"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          <Disclosure icon="🔍" title="Products explored" count={intel.products.length} defaultOpen>
            {intel.products.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Nothing yet — ask for something.</p>
            ) : (
              <div className="space-y-1">
                {intel.products.slice(0, 20).map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            )}
          </Disclosure>

          <Disclosure
            icon="🛒"
            title="In cart"
            count={intel.cartItems.length || liveCart?.item_count || 0}
          >
            {intel.cartItems.length === 0 && !(liveCart?.items?.length) ? (
              <p className="text-xs text-gray-500 italic">Cart is empty.</p>
            ) : (
              <>
                <ul className="space-y-1">
                  {(intel.cartItems.length ? intel.cartItems : liveCart?.items || []).slice(0, 10).map((it) => (
                    <li key={it.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        {it.quantity}× {it.product_name}
                        <span className="text-gray-400"> · {it.merchant}</span>
                      </span>
                      <span className="font-medium text-gray-800 ml-2 flex-shrink-0">
                        {formatKES(it.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="font-semibold text-gray-900">
                    {formatKES(intel.cartTotal || liveCart?.total || 0)}
                  </span>
                </div>
                {(intel.cartSavings || liveCart?.savings_vs_worst_split) > 0 && (
                  <p className="mt-1 text-[11px] text-green-700">
                    Saving {formatKES(intel.cartSavings || liveCart?.savings_vs_worst_split)} vs worst-case.
                  </p>
                )}
              </>
            )}
          </Disclosure>

          <Disclosure icon="📈" title="Tracking" count={intel.rules.length}>
            {intel.rules.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No tracking set in this chat.</p>
            ) : (
              <ul className="space-y-1">
                {intel.rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{r.product_name || `Product #${r.id}`}</span>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {r.action === 'add_to_cart' ? 'Auto' : 'Alert'}
                      {r.target_price != null && ` · ${formatKES(r.target_price)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Disclosure>

          <Disclosure icon="🏪" title="Merchants seen" count={intel.merchants.length}>
            {intel.merchants.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No merchants referenced yet.</p>
            ) : (
              <ul className="space-y-1">
                {intel.merchants
                  .sort((a, b) => (a.min_price ?? Infinity) - (b.min_price ?? Infinity))
                  .map((m) => (
                    <li key={m.name} className="flex items-center justify-between text-sm">
                      <span className="truncate">{m.name}</span>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {m.min_price != null ? `from ${formatKES(m.min_price)}` : ''}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Disclosure>
        </div>
      )}
    </div>
  );
};

export default IntelligencePanel;
