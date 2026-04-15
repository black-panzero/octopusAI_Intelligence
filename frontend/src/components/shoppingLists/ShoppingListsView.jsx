// src/components/shoppingLists/ShoppingListsView.jsx
// Lists tab — shopping lists + wishlists. CRUD with inline editing.
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { shoppingListsApi } from '../../api';
import { useCartStore } from '../../stores/cartStore';
import { formatKES, formatDate } from '../../lib/format';
import { extractErrorMessage } from '../../lib/errors';

const ListItem = ({ item, onToggle, onRemove, onQuantity }) => (
  <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0">
    <input
      type="checkbox"
      checked={!!item.completed}
      onChange={(e) => onToggle(item, e.target.checked)}
      className="rounded text-blue-600 focus:ring-blue-500"
    />
    {item.product_image_url ? (
      <img src={item.product_image_url} alt="" className="w-8 h-8 rounded object-cover bg-gray-100"
           onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
    ) : (
      <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />
    )}
    <div className={`flex-1 min-w-0 ${item.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
      <p className="text-sm truncate">
        {item.product_name || item.note || '(no description)'}
      </p>
      {item.current_best_price != null && (
        <p className="text-[11px] text-gray-500">
          from {formatKES(item.current_best_price)}{item.current_best_merchant && ` · ${item.current_best_merchant}`}
        </p>
      )}
    </div>
    <div className="flex items-center gap-1">
      <button onClick={() => onQuantity(item, item.quantity - 1)}
              className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-50 text-sm">−</button>
      <span className="min-w-[1.25rem] text-center text-sm">{item.quantity}</span>
      <button onClick={() => onQuantity(item, item.quantity + 1)}
              className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-50 text-sm">+</button>
    </div>
    <button onClick={() => onRemove(item)} className="text-xs text-red-500 hover:text-red-700">✕</button>
  </div>
);

const ListCard = ({ list, onSelect, isActive }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left rounded-lg border p-3 transition ${
      isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
    }`}
  >
    <div className="flex items-center justify-between mb-1">
      <span className={`text-xs font-semibold uppercase tracking-wide ${
        list.kind === 'wishlist' ? 'text-pink-600' : 'text-blue-600'
      }`}>
        {list.kind}
      </span>
      <span className="text-[10px] text-gray-400">{formatDate(list.updated_at)}</span>
    </div>
    <p className="font-semibold text-gray-900 truncate">{list.title}</p>
    <p className="text-xs text-gray-500 mt-1">{list.item_count} item{list.item_count === 1 ? '' : 's'}</p>
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
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Shopping Lists &amp; Wishlists</h1>
            <p className="text-indigo-100 text-sm">
              Build lists manually, or let the AI create and fill them. When
              you're ready, send the whole list to your cart in one click.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 bg-white text-indigo-700 font-semibold px-4 py-2 rounded-md shadow hover:bg-indigo-50"
          >
            + New list
          </button>
        </div>
      </div>

      {creating && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="List title (e.g. Weekly groceries)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="shopping">Shopping</option>
            <option value="wishlist">Wishlist</option>
          </select>
          <button onClick={handleCreate}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            Create
          </button>
          <button onClick={() => setCreating(false)} className="text-sm text-gray-500 hover:text-gray-800">
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <aside className="space-y-4">
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {!loading && lists.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500">
              No lists yet. Click <b>+ New list</b> above or ask the AI to build one.
            </div>
          )}

          {grouped.shopping.length > 0 && (
            <section>
              <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">
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
              <p className="text-xs font-semibold tracking-wide text-pink-600 uppercase mb-2">
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
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-sm text-gray-500">
              Pick a list on the left, or create a new one.
            </div>
          )}
          {active && (
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      active.kind === 'wishlist' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                    }`}>{active.kind}</span>
                    <h2 className="text-lg font-bold text-gray-900 truncate">{active.title}</h2>
                  </div>
                  <p className="text-xs text-gray-500">{active.item_count} item{active.item_count === 1 ? '' : 's'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleRename} className="text-xs text-gray-600 hover:text-gray-900">Rename</button>
                  <button onClick={handleSendToCart}
                          disabled={!active.items.some((i) => !i.completed)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                            active.items.some((i) => !i.completed)
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}>
                    Send to cart →
                  </button>
                  <button onClick={handleDeleteList} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>

              <div className="px-4">
                {active.items.length === 0 ? (
                  <p className="py-8 text-sm text-center text-gray-500">No items yet — add one below.</p>
                ) : (
                  active.items.map((it) => (
                    <ListItem key={it.id} item={it}
                              onToggle={handleToggle}
                              onRemove={handleRemove}
                              onQuantity={handleQty} />
                  ))
                )}
              </div>

              <div className="p-4 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Add item (e.g. 2kg Pishori rice)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={handleAddNote}
                        disabled={!addNote.trim()}
                        className={`px-3 py-2 rounded-md text-sm font-medium text-white ${
                          addNote.trim() ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed'
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
