// src/components/chat/IntelligencePanel.jsx
// Right-side conversation intelligence — scoped strictly to the ACTIVE chat.
// Summarizes: products explored here, items this chat added to the cart,
// tracking rules created, merchants seen, and shopping lists touched.
//
// Cart section deliberately shows "N/M in cart" — N=added-in-this-chat,
// M=total across all conversations — so the user understands the scope.
import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useChatStore } from '../../stores/chatStore';
import { useCartStore } from '../../stores/cartStore';
import { formatKES, formatRating } from '../../lib/format';

const deriveIntelForChat = (messages, invocationsByIdx) => {
  const products = new Map();
  const merchants = new Map();
  const rulesById = new Map();
  const listsById = new Map();
  // items added *in this chat* — keyed by cart item id so repeated views
  // of the same item don't multiply.
  const chatCartItems = new Map();

  const noteProduct = (p) => { if (p && p.id != null) products.set(p.id, p); };
  const noteMerchant = (name, offer) => {
    if (!name) return;
    const prev = merchants.get(name) || { name, count: 0, min_price: Infinity };
    prev.count += 1;
    if (offer && typeof offer.price === 'number' && offer.price < prev.min_price) {
      prev.min_price = offer.price;
    }
    merchants.set(name, prev);
  };

  const invs = Object.values(invocationsByIdx || {}).flat();
  for (const inv of invs) {
    const r = inv?.result || {};
    const args = inv?.arguments || {};
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
      case 'add_to_cart': {
        // Find the item matching (product_id, merchant_id) in the returned cart.
        const cart = r.cart || {};
        const match = (cart.items || []).find(
          (it) => it.product_id === args.product_id && it.merchant_id === args.merchant_id,
        );
        if (match) chatCartItems.set(match.id, match);
        break;
      }
      case 'remove_cart_item': {
        chatCartItems.delete(args.item_id);
        break;
      }
      case 'update_cart_quantity': {
        if (args.quantity === 0) chatCartItems.delete(args.item_id);
        else {
          const cart = r.cart || {};
          const match = (cart.items || []).find((it) => it.id === args.item_id);
          if (match) chatCartItems.set(match.id, match);
        }
        break;
      }
      case 'clear_cart': {
        chatCartItems.clear();
        break;
      }
      case 'list_rules': {
        (r.rules || []).forEach((ru) => rulesById.set(ru.id, ru));
        break;
      }
      case 'create_price_rule': {
        if (r.rule_id) rulesById.set(r.rule_id, {
          id: r.rule_id,
          action: r.action,
          target_price: r.target_price,
        });
        break;
      }
      case 'list_shopping_lists': {
        (r.lists || []).forEach((l) => listsById.set(l.id, l));
        break;
      }
      case 'get_shopping_list':
      case 'create_shopping_list':
      case 'update_shopping_list':
      case 'add_shopping_list_item':
      case 'update_shopping_list_item':
      case 'remove_shopping_list_item': {
        if (r.list && r.list.id != null) listsById.set(r.list.id, r.list);
        break;
      }
      case 'send_shopping_list_to_cart': {
        if (r.list_id && r.list_title) {
          const prev = listsById.get(r.list_id) || { id: r.list_id, title: r.list_title };
          listsById.set(r.list_id, { ...prev, last_send_summary: {
            added: r.added_count, skipped: r.skipped_count,
          }});
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
    chatCartItems: [...chatCartItems.values()],
    rules: [...rulesById.values()],
    lists: [...listsById.values()],
  };
};

const Disclosure = ({ icon, title, count, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-border-b last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-2.5 px-3 glass-hover focus:outline-none"
      >
        <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <span className="text-base">{icon}</span>
          <span className="font-medium">{title}</span>
          {count != null && (
            <span className="text-[10px] glass-subtle rounded-full px-1.5 py-0.5" style={{ color: 'var(--text-secondary)' }}>
              {count}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 transform transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-tertiary)' }}
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
      <img src={product.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 glass-light"
           onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
    ) : (
      <div className="w-8 h-8 rounded glass-light flex-shrink-0" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{product.display_name}</p>
      <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
        {[product.brand, product.category, product.size].filter(Boolean).join(' · ')}
        {product.rating != null && ` · ${formatRating(product.rating, product.review_count)}`}
      </p>
    </div>
  </div>
);

const IntelligencePanel = ({ collapsed, onToggle }) => {
  const messages = useChatStore((s) => s.messages);
  const invByIdx = useChatStore((s) => s.invocationsByIdx);
  const conversationId = useChatStore((s) => s.conversationId);
  const liveCartCount = useCartStore((s) => s.cart.item_count);
  const liveCartTotal = useCartStore((s) => s.cart.total);

  const intel = useMemo(() => deriveIntelForChat(messages, invByIdx), [messages, invByIdx]);

  const chatCartCount = intel.chatCartItems.length;
  const cartFraction = liveCartCount > 0 ? `${chatCartCount}/${liveCartCount}` : `${chatCartCount}`;

  const summary = [
    intel.products.length && `${intel.products.length} explored`,
    (chatCartCount || liveCartCount) && `${cartFraction} in cart`,
    intel.rules.length && `${intel.rules.length} tracked`,
    intel.lists.length && `${intel.lists.length} list${intel.lists.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col h-full glass glass-border-l">
      <div className="px-3 py-2 glass-border-b flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-tertiary)' }}>
            {collapsed ? 'Intel' : 'This chat'}
          </p>
          {!collapsed && summary && (
            <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{summary}</p>
          )}
        </div>
        <button
          onClick={onToggle}
          className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}
          title={collapsed ? 'Expand' : 'Collapse'}
          aria-label={collapsed ? 'Expand intelligence panel' : 'Collapse intelligence panel'}
        >
          {collapsed ? '‹' : '›'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto glass-scroll">
          {!conversationId && messages.length === 0 && (
            <p className="px-3 py-4 text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
              Start chatting — items and decisions from this conversation appear here.
            </p>
          )}

          <Disclosure icon="🔍" title="Products explored" count={intel.products.length} defaultOpen>
            {intel.products.length === 0 ? (
              <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>Nothing yet.</p>
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
            title={liveCartCount > 0 ? `Added in this chat (${cartFraction} in cart)` : 'Added in this chat'}
            count={chatCartCount}
          >
            {chatCartCount === 0 ? (
              <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                {liveCartCount > 0
                  ? `You have ${liveCartCount} item${liveCartCount === 1 ? '' : 's'} in cart from other conversations.`
                  : 'Ask the AI to add something to see it here.'}
              </p>
            ) : (
              <>
                <ul className="space-y-1">
                  {intel.chatCartItems.map((it) => (
                    <li key={it.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        {it.quantity}× {it.product_name}
                        <span style={{ color: 'var(--text-tertiary)' }}> · {it.merchant}</span>
                      </span>
                      <span className="font-medium ml-2 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                        {formatKES(it.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
                {liveCartCount > chatCartCount && (
                  <p className="mt-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {liveCartCount - chatCartCount} more item{liveCartCount - chatCartCount === 1 ? '' : 's'} in cart from elsewhere. Total {formatKES(liveCartTotal || 0)}.
                  </p>
                )}
              </>
            )}
          </Disclosure>

          <Disclosure icon="📝" title="Shopping lists touched" count={intel.lists.length}>
            {intel.lists.length === 0 ? (
              <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>No lists referenced in this chat.</p>
            ) : (
              <ul className="space-y-1.5">
                {intel.lists.map((l) => (
                  <li key={l.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        <span className="text-[10px] uppercase tracking-wide mr-1" style={{ color: l.kind === 'wishlist' ? 'var(--color-fuchsia)' : 'var(--color-primary)' }}>
                          {l.kind || 'list'}
                        </span>
                        {l.title}
                      </span>
                      <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                        {l.item_count ?? (l.items?.length ?? 0)} items
                      </span>
                    </div>
                    {l.last_send_summary && (
                      <p className="text-[11px] ml-10" style={{ color: 'var(--color-green)' }}>
                        Sent to cart: {l.last_send_summary.added} added
                        {l.last_send_summary.skipped ? `, ${l.last_send_summary.skipped} skipped` : ''}.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Disclosure>

          <Disclosure icon="📈" title="Tracking rules set" count={intel.rules.length}>
            {intel.rules.length === 0 ? (
              <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>No tracking set in this chat.</p>
            ) : (
              <ul className="space-y-1">
                {intel.rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{r.product_name || `Product #${r.id}`}</span>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
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
              <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>No merchants referenced yet.</p>
            ) : (
              <ul className="space-y-1">
                {intel.merchants
                  .sort((a, b) => (a.min_price ?? Infinity) - (b.min_price ?? Infinity))
                  .map((m) => (
                    <li key={m.name} className="flex items-center justify-between text-sm">
                      <span className="truncate">{m.name}</span>
                      <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
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
