// src/components/shoppingLists/ShoppingListsView.jsx
// Lists tab — shopping lists + wishlists. CRUD with inline editing.
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { shoppingListsApi } from '../../api';
import { useCartStore } from '../../stores/cartStore';
import { formatKES, formatDate } from '../../lib/format';
import { extractErrorMessage } from '../../lib/errors';

const ListItem = ({ item, onToggle, onRemove, onQuantity }) => (
  <div className="flex items-center gap-3 py-2 glass-border-b last:border-b-0">
    <input
      type="checkbox"
      checked={!!item.completed}
      onChange={(e) => onToggle(item, e.target.checked)}
      className="rounded"
      style={{ accentColor: 'var(--color-primary)' }}
    />
    {item.product_image_url ? (
      <img src={item.product_image_url} alt="" className="w-8 h-8 rounded object-cover glass-light"
           onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
    ) : (
      <div className="w-8 h-8 rounded glass-light flex-shrink-0" />
    )}
    <div className={`flex-1 min-w-0 ${item.completed ? 'line-through' : ''}`} style={{ color: item.completed ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
      <p className="text-sm truncate">
        {item.product_name || item.note || '(no description)'}
      </p>
      {item.current_best_price != null && (
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          from {formatKES(item.current_best_price)}{item.current_best_merchant && ` · ${item.current_best_merchant}`}
        </p>
      )}
    </div>
    <div className="flex items-center gap-1">
      <button onClick={() => onQuantity(item, item.quantity - 1)}
              className="glass-btn glass-btn-ghost w-6 h-6 text-sm">−</button>
      <span className="min-w-[1.25rem] text-center text-sm">{item.quantity}</span>
      <button onClick={() => onQuantity(item, item.quantity + 1)}
              className="glass-btn glass-btn-ghost w-6 h-6 text-sm">+</button>
    </div>
    <button onClick={() => onRemove(item)} className="text-xs" style={{ color: 'var(--color-red)' }}>✕</button>
  </div>
);

const ListCard = ({ list, onSelect, isActive }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left rounded-[var(--r-lg)] p-3 transition ${
      isActive ? 'glass-card ring-1' : 'glass-card glass-hover'
    }`}
    style={isActive ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 1px var(--color-primary-soft)' } : {}}
  >
    <div className="flex items-center justify-between mb-1">
      <span className={`text-xs font-semibold uppercase tracking-wide ${
        list.kind === 'wishlist' ? '' : ''
      }`} style={{ color: list.kind === 'wishlist' ? 'var(--color-fuchsia)' : 'var(--color-primary)' }}>
        {list.kind}
      </span>
      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{formatDate(list.updated_at)}</span>
    </div>
    <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{list.title}</p>
    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{list.item_count} item{list.item_count === 1 ? '' : 's'}</p>
  </button>
);

const ShoppingListsView = ({ onNavigate }) => {
  const [lists, setLists] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addNote, setAddNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState('shopping');

  const refreshCart = useCartStore((s) => s.refresh);

  const load = async () => {
    setLoading(true);
    try {
      const data = await shoppingListsApi.list({ include_archived: false });
      setLists(Array.isArray(data) ? data : []);
      if (data?.length && activeId == null) {
        setActiveId(data[0].id);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to load lists'));
    } finally {
      setLoading(false);
    }
  };

  const loadActive = async (id) => {
    if (id == null) { setActive(null); return; }
    try {
      const data = await shoppingListsApi.get(id);
      setActive(data);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to load list'));
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadActive(activeId); }, [activeId]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const data = await shoppingListsApi.create({ title, kind: newKind });
      toast.success('List created');
      setNewTitle('');
      setCreating(false);
      await load();
      setActiveId(data.id);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to create list'));
    }
  };

  const handleAddNote = async () => {
    if (!active || !addNote.trim()) return;
    try {
      const updated = await shoppingListsApi.addItem(active.id, { note: addNote.trim(), quantity: 1 });
      setActive(updated);
      setAddNote('');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to add item'));
    }
  };

  const handleToggle = async (item, completed) => {
    try {
      const updated = await shoppingListsApi.updateItem(active.id, item.id, { completed });
      setActive(updated);
    } catch (err) { toast.error(extractErrorMessage(err, 'Update failed')); }
  };

  const handleRemove = async (item) => {
    try {
      const updated = await shoppingListsApi.removeItem(active.id, item.id);
      setActive(updated);
    } catch (err) { toast.error(extractErrorMessage(err, 'Remove failed')); }
  };

  const handleQty = async (item, quantity) => {
    if (quantity < 1) return handleRemove(item);
    try {
      const updated = await shoppingListsApi.updateItem(active.id, item.id, { quantity });
      setActive(updated);
    } catch (err) { toast.error(extractErrorMessage(err, 'Update failed')); }
  };

  const handleSendToCart = async () => {
    if (!active) return;
    try {
      const result = await shoppingListsApi.sendToCart(active.id);
      await refreshCart();
      if (result.added_count === 0) {
        toast('No items resolved to products');
      } else if (result.skipped_count > 0) {
        toast.success(`Added ${result.added_count}, skipped ${result.skipped_count}`);
      } else {
        toast.success(`Added ${result.added_count} items to cart`);
      }
      onNavigate?.('cart');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to send to cart'));
    }
  };

  const handleDeleteList = async () => {
    if (!active) return;
    if (!confirm(`Delete "${active.title}"?`)) return;
    try {
      await shoppingListsApi.delete(active.id);
      toast.success('List deleted');
      setActive(null);
      setActiveId(null);
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Delete failed'));
    }
  };

  const handleRename = async () => {
    if (!active) return;
    const title = prompt('New title', active.title);
    if (!title || title.trim() === active.title) return;
    try {
      const updated = await shoppingListsApi.patch(active.id, { title: title.trim() });
      setActive(updated);
      await load();
      toast.success('Renamed');
    } catch (err) { toast.error(extractErrorMessage(err, 'Rename failed')); }
  };

  const grouped = useMemo(() => {
    const groups = { shopping: [], wishlist: [] };
    for (const l of lists) {
      (groups[l.kind] || groups.shopping).push(l);
    }
    return groups;
  }, [lists]);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 text-white" style={{ background: 'var(--brand-gradient)' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Shopping Lists &amp; Wishlists</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Build lists manually, or let the AI create and fill them. When
              you're ready, send the whole list to your cart in one click.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="glass-btn glass-btn-surface inline-flex items-center gap-2 font-semibold px-4 py-2"
          >
            + New list
          </button>
        </div>
      </div>

      {creating && (
        <div className="glass-card p-4 flex items-center gap-3">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="List title (e.g. Weekly groceries)"
            className="glass-input flex-1 px-3 py-2 text-sm"
          />
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value)}
            className="glass-input px-3 py-2 text-sm"
          >
            <option value="shopping">Shopping</option>
            <option value="wishlist">Wishlist</option>
          </select>
          <button onClick={handleCreate}
                  className="glass-btn glass-btn-brand px-4 py-2 text-sm font-medium">
            Create
          </button>
          <button onClick={() => setCreating(false)} className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <aside className="space-y-4">
          {loading && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>}
          {!loading && lists.length === 0 && (
            <div className="glass-card p-6 text-center text-sm" style={{ borderStyle: 'dashed', color: 'var(--text-tertiary)' }}>
              No lists yet. Click <b>+ New list</b> above or ask the AI to build one.
            </div>
          )}

          {grouped.shopping.length > 0 && (
            <section>
              <p className="text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Shopping ({grouped.shopping.length})
              </p>
              <div className="space-y-2">
                {grouped.shopping.map((l) => (
                  <ListCard key={l.id} list={l} isActive={l.id === activeId} onSelect={() => setActiveId(l.id)} />
                ))}
              </div>
            </section>
          )}
          {grouped.wishlist.length > 0 && (
            <section>
              <p className="text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: 'var(--color-fuchsia)' }}>
                Wishlists ({grouped.wishlist.length})
              </p>
              <div className="space-y-2">
                {grouped.wishlist.map((l) => (
                  <ListCard key={l.id} list={l} isActive={l.id === activeId} onSelect={() => setActiveId(l.id)} />
                ))}
              </div>
            </section>
          )}
        </aside>

        <div className="lg:col-span-2">
          {!active && (
            <div className="glass-card p-10 text-center text-sm" style={{ borderStyle: 'dashed', color: 'var(--text-tertiary)' }}>
              Pick a list on the left, or create a new one.
            </div>
          )}
          {active && (
            <div className="glass-card overflow-hidden">
              <div className="flex items-center justify-between p-4 glass-border-b">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--r-sm)] ${
                      active.kind === 'wishlist' ? 'badge-purple' : 'badge-blue'
                    }`}>{active.kind}</span>
                    <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{active.title}</h2>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{active.item_count} item{active.item_count === 1 ? '' : 's'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleRename} className="text-xs" style={{ color: 'var(--text-secondary)' }}>Rename</button>
                  <button onClick={handleSendToCart}
                          disabled={!active.items.some((i) => !i.completed)}
                          className={`glass-btn text-xs font-semibold px-3 py-1.5 ${
                            active.items.some((i) => !i.completed)
                              ? 'glass-btn-primary'
                              : 'opacity-40 cursor-not-allowed glass-btn-ghost'
                          }`}>
                    Send to cart →
                  </button>
                  <button onClick={handleDeleteList} className="text-xs" style={{ color: 'var(--color-red)' }}>Delete</button>
                </div>
              </div>

              <div className="px-4">
                {active.items.length === 0 ? (
                  <p className="py-8 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>No items yet — add one below.</p>
                ) : (
                  active.items.map((it) => (
                    <ListItem key={it.id} item={it}
                              onToggle={handleToggle}
                              onRemove={handleRemove}
                              onQuantity={handleQty} />
                  ))
                )}
              </div>

              <div className="p-4 glass-border-t flex gap-2">
                <input
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Add item (e.g. 2kg Pishori rice)"
                  className="glass-input flex-1 px-3 py-2 text-sm"
                />
                <button onClick={handleAddNote}
                        disabled={!addNote.trim()}
                        className={`glass-btn px-3 py-2 text-sm font-medium ${
                          addNote.trim() ? 'glass-btn-brand' : 'opacity-40 cursor-not-allowed glass-btn-ghost'
                        }`}>
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingListsView;
