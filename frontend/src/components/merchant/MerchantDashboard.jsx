// Merchant dashboard — product listings, add product, analytics.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { merchantApi } from '../../api';
import { formatKES, formatDate } from '../../lib/format';
import { extractErrorMessage } from '../../lib/errors';

const AddProductForm = ({ onAdded }) => {
  const [form, setForm] = useState({
    product_name: '', price: '', brand: '', category: '',
    size: '', url: '', image_url: '', description: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_name.trim() || !form.price) return;
    setLoading(true);
    try {
      await merchantApi.addProduct({
        product_name: form.product_name.trim(),
        price: Number(form.price),
        brand: form.brand.trim() || null,
        category: form.category.trim() || null,
        size: form.size.trim() || null,
        url: form.url.trim() || null,
        image_url: form.image_url.trim() || null,
        description: form.description.trim() || null,
      });
      toast.success('Product listed');
      setForm({ product_name: '', price: '', brand: '', category: '', size: '', url: '', image_url: '', description: '' });
      onAdded?.();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to add product'));
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Product name *</label>
          <input name="product_name" value={form.product_name} onChange={handleChange} required
                 placeholder="e.g. Pishori Rice 5kg" className="glass-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Price (KES) *</label>
          <input name="price" type="number" value={form.price} onChange={handleChange} required min="0" step="1"
                 placeholder="899" className="glass-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Brand</label>
          <input name="brand" value={form.brand} onChange={handleChange}
                 placeholder="e.g. Mwea" className="glass-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
          <input name="category" value={form.category} onChange={handleChange}
                 placeholder="e.g. Groceries" className="glass-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Size</label>
          <input name="size" value={form.size} onChange={handleChange}
                 placeholder="e.g. 5kg" className="glass-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Product URL</label>
          <input name="url" value={form.url} onChange={handleChange}
                 placeholder="https://..." className="glass-input w-full px-3 py-2 text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Image URL</label>
          <input name="image_url" value={form.image_url} onChange={handleChange}
                 placeholder="https://...product-image.jpg" className="glass-input w-full px-3 py-2 text-sm" />
        </div>
      </div>
      <button type="submit" disabled={loading} className="glass-btn glass-btn-brand px-4 py-2 text-sm">
        {loading ? 'Adding...' : 'List product'}
      </button>
    </form>
  );
};

const MerchantDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState({ items: [], total: 0, page: 1 });
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState('');

  const loadDash = async () => {
    try { setDashboard(await merchantApi.dashboard()); }
    catch (err) { toast.error(extractErrorMessage(err, 'Failed to load dashboard')); }
  };
  const loadProducts = async (page = 1) => {
    try { setProducts(await merchantApi.listProducts({ page, size: 20, q })); }
    catch (err) { toast.error(extractErrorMessage(err, 'Failed to load products')); }
  };

  useEffect(() => { loadDash(); loadProducts(); }, []);
  useEffect(() => { loadProducts(1); }, [q]);

  const handleRemove = async (id) => {
    if (!confirm('Remove this listing?')) return;
    try {
      await merchantApi.removeProduct(id);
      toast.success('Listing removed');
      loadProducts(products.page);
      loadDash();
    } catch (err) { toast.error(extractErrorMessage(err, 'Failed to remove')); }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 text-white" style={{ background: 'var(--brand-gradient)' }}>
        <h1 className="text-2xl font-bold mb-1">Merchant Dashboard</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)' }}>
          {dashboard?.merchant?.name || 'Your store'} — manage listings & track performance
        </p>
      </div>

      {/* Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Products listed</p>
            <p className="text-3xl font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{dashboard.stats.unique_products}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Price snapshots</p>
            <p className="text-3xl font-bold mt-1" style={{ color: 'var(--color-green)' }}>{dashboard.stats.total_listings}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Avg. price</p>
            <p className="text-3xl font-bold mt-1" style={{ color: 'var(--color-amber)' }}>{formatKES(dashboard.stats.avg_price)}</p>
          </div>
        </div>
      )}

      {/* Add product */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {showForm ? 'Add new product' : 'Your products'}
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`glass-btn text-sm px-3 py-1.5 ${showForm ? 'glass-btn-ghost' : 'glass-btn-brand'}`}
          >
            {showForm ? 'Cancel' : '+ Add product'}
          </button>
        </div>

        {showForm && (
          <AddProductForm onAdded={() => { setShowForm(false); loadProducts(); loadDash(); }} />
        )}

        {!showForm && (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your products..."
              className="glass-input w-full px-3 py-2 text-sm mb-4"
            />

            <div className="space-y-2">
              {(products.items || []).map((p) => (
                <div key={`${p.product_id}-${p.last_updated}`} className="glass glass-border rounded-[var(--r-md)] p-3 flex items-center gap-3">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="w-12 h-12 rounded-[var(--r-sm)] object-cover glass-light"
                         onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-[var(--r-sm)] glass-light" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.display_name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {[p.brand, p.category, p.size].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{formatKES(p.price)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {p.is_available ? 'Available' : 'Unavailable'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(p.product_id)}
                    className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-red)' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {products.items.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                  No products yet. Click <b>+ Add product</b> to list your first item.
                </p>
              )}
            </div>

            {products.total > 20 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => loadProducts(Math.max(1, products.page - 1))}
                  disabled={products.page <= 1}
                  className="glass-btn glass-btn-ghost text-xs px-3 py-1"
                >← Prev</button>
                <span className="text-xs self-center" style={{ color: 'var(--text-tertiary)' }}>
                  Page {products.page}
                </span>
                <button
                  onClick={() => loadProducts(products.page + 1)}
                  disabled={products.page * 20 >= products.total}
                  className="glass-btn glass-btn-ghost text-xs px-3 py-1"
                >Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MerchantDashboard;
