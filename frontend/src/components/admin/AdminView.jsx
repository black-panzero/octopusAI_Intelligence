// src/components/admin/AdminView.jsx
// Superuser-only admin panel. Stats, merchants, products, snapshots,
// manual scrape trigger, image backfill.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api';
import { formatKES, formatDate } from '../../lib/format';
import { extractErrorMessage } from '../../lib/errors';

const Stat = ({ label, value, accent = 'blue' }) => {
  const accents = {
    blue:   'var(--color-primary)',
    green:  'var(--color-green)',
    purple: 'var(--color-purple)',
    orange: 'var(--color-amber)',
    rose:   'var(--color-red)',
  };
  return (
    <div className="glass-card p-4">
      <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: accents[accent] || accents.blue }}>
        {(Number(value) || 0).toLocaleString('en-KE')}
      </p>
    </div>
  );
};

const StatsBlock = ({ stats }) => {
  if (!stats) return null;
  const coverage = stats.products > 0
    ? Math.round((stats.products_with_image / stats.products) * 100)
    : 0;
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Users"        value={stats.users}        accent="blue" />
        <Stat label="Merchants"    value={stats.merchants}    accent="purple" />
        <Stat label="Products"     value={stats.products}     accent="green" />
        <Stat label="Snapshots"    value={stats.price_snapshots} accent="orange" />
        <Stat label="Cart items"   value={stats.cart_items}   accent="blue" />
        <Stat label="Lists"        value={stats.shopping_lists} accent="purple" />
        <Stat label="Rules"        value={stats.rules}        accent="rose" />
        <Stat label="Conversations" value={stats.conversations} accent="green" />
      </div>
      <div className="glass-card p-4 mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Image coverage</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {stats.products_with_image} of {stats.products} products have an image ({coverage}%).
          </p>
        </div>
        <div className="w-40 h-2 glass-light rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${coverage}%`, background: 'var(--color-green)' }} />
        </div>
      </div>
    </>
  );
};

const MerchantsTable = ({ rows }) => (
  <div className="glass-card overflow-hidden">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="glass-light">
          <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Slug</th>
          <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Name</th>
          <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Base URL</th>
          <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Snapshots</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id} className="glass-border-t">
            <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{m.slug}</td>
            <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{m.name}</td>
            <td className="px-3 py-2">
              {m.base_url && (
                <a href={m.base_url} target="_blank" rel="noopener noreferrer"
                   className="text-xs truncate max-w-xs inline-block" style={{ color: 'var(--color-primary)' }}>
                  {m.base_url}
                </a>
              )}
            </td>
            <td className="px-3 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>{m.snapshot_count.toLocaleString('en-KE')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ProductRow = ({ product, onOpen }) => (
  <button
    onClick={() => onOpen(product)}
    className="w-full text-left glass-border-t glass-hover grid grid-cols-12 gap-2 items-center p-2"
  >
    <div className="col-span-1">
      {product.image_url ? (
        <img src={product.image_url} alt=""
             className="w-10 h-10 object-cover rounded-[var(--r-sm)] glass-light"
             loading="lazy"
             onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
      ) : (
        <div className="w-10 h-10 glass-light rounded-[var(--r-sm)]" />
      )}
    </div>
    <div className="col-span-5 min-w-0">
      <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{product.display_name}</p>
      <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
        {[product.brand, product.category, product.size].filter(Boolean).join(' · ')}
      </p>
    </div>
    <div className="col-span-2 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
      {product.rating != null ? `★ ${product.rating} (${product.review_count ?? 0})` : '—'}
    </div>
    <div className="col-span-2 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
      {product.specs_keys.length ? `${product.specs_keys.length} specs` : '—'}
    </div>
    <div className="col-span-2 text-xs truncate text-right" style={{ color: 'var(--text-tertiary)' }}>
      {formatDate(product.updated_at)}
    </div>
  </button>
);

const SnapshotsPane = ({ product, snapshots, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="glass-card glass-shadow-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
         style={{ background: 'var(--glass-bg-solid)' }}
         onClick={(e) => e.stopPropagation()}>
      <div className="p-4 glass-border-b flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Product</p>
          <p className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{product.display_name}</p>
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>✕</button>
      </div>
      <div className="overflow-auto flex-1 glass-scroll">
        <table className="min-w-full text-sm">
          <thead className="glass-light sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Merchant</th>
              <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Price</th>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Captured</th>
              <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>URL</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className="glass-border-t">
                <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{s.merchant}</td>
                <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{formatKES(s.price)}</td>
                <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatDate(s.captured_at, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-3 py-2 text-xs">
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate max-w-xs inline-block" style={{ color: 'var(--color-primary)' }}>
                      {s.url}
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {snapshots.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>No snapshots captured yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const AdminView = () => {
  const [section, setSection] = useState('overview');
  const [stats, setStats] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [products, setProducts] = useState({ items: [], total: 0, page: 1 });
  const [q, setQ] = useState('');
  const [missingImage, setMissingImage] = useState(false);
  const [selected, setSelected] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [scrapeQ, setScrapeQ] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStats = async () => {
    try { setStats(await adminApi.stats()); }
    catch (err) { toast.error(extractErrorMessage(err, 'Failed to load stats')); }
  };
  const loadMerchants = async () => {
    try { setMerchants(await adminApi.merchants()); }
    catch (err) { toast.error(extractErrorMessage(err, 'Failed to load merchants')); }
  };
  const loadProducts = async (page = 1) => {
    try { setProducts(await adminApi.products({ page, size: 30, q, missing_image: missingImage })); }
    catch (err) { toast.error(extractErrorMessage(err, 'Failed to load products')); }
  };

  useEffect(() => {
    loadStats();
    loadMerchants();
    loadProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // reload when filters change
    loadProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, missingImage]);

  const handleOpen = async (product) => {
    setSelected(product);
    setSnapshots([]);
    try {
      setSnapshots(await adminApi.snapshots(product.id, 100));
    } catch (err) { toast.error(extractErrorMessage(err, 'Failed to load snapshots')); }
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    const query = scrapeQ.trim();
    if (!query) return;
    setBusy(true);
    try {
      const summary = await adminApi.scrape(query);
      toast.success(`Swept ${(summary.scrapers_ran || []).length} stores, ${summary.offers_persisted} new offers`);
      await Promise.all([loadStats(), loadMerchants(), loadProducts(1)]);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Scrape failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleResolveImages = async () => {
    setBusy(true);
    try {
      const r = await adminApi.resolveImages(30);
      toast.success(`Resolved ${r.resolved} image${r.resolved === 1 ? '' : 's'}`);
      await Promise.all([loadStats(), loadProducts(products.page || 1)]);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Image resolve failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%)' }}>
        <h1 className="text-2xl font-bold mb-1">Admin</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Catalog inspection and control. Use with care — actions here hit real merchants.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['overview', 'merchants', 'products', 'operations'].map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`glass-btn text-sm px-3 py-1.5 rounded-full capitalize ${
              section === s ? 'glass-btn-primary' : 'glass-btn-surface'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {section === 'overview' && <StatsBlock stats={stats} />}

      {section === 'merchants' && <MerchantsTable rows={merchants} />}

      {section === 'products' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / brand…"
              className="glass-input flex-1 min-w-[200px] px-3 py-2 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={missingImage}
                     onChange={(e) => setMissingImage(e.target.checked)}
                     className="rounded" />
              Missing image only
            </label>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>{products.total.toLocaleString('en-KE')} total</span>
          </div>

          <div className="glass-card overflow-hidden">
            {(products.items || []).map((p) => (
              <ProductRow key={p.id} product={p} onOpen={handleOpen} />
            ))}
            {products.items.length === 0 && (
              <p className="p-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No products.</p>
            )}
          </div>

          {products.total > products.size && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => loadProducts(Math.max(1, products.page - 1))}
                disabled={products.page <= 1}
                className="glass-btn glass-btn-ghost text-xs px-3 py-1"
              >← Prev</button>
              <span className="text-xs self-center" style={{ color: 'var(--text-tertiary)' }}>
                Page {products.page} / {Math.ceil(products.total / products.size)}
              </span>
              <button
                onClick={() => loadProducts(products.page + 1)}
                disabled={products.page * products.size >= products.total}
                className="glass-btn glass-btn-ghost text-xs px-3 py-1"
              >Next →</button>
            </div>
          )}
        </>
      )}

      {section === 'operations' && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Manual scrape</h2>
            <form onSubmit={handleScrape} className="flex gap-2">
              <input
                value={scrapeQ}
                onChange={(e) => setScrapeQ(e.target.value)}
                placeholder="e.g. rice, samsung, cooking oil"
                className="glass-input flex-1 px-3 py-2 text-sm"
              />
              <button type="submit" disabled={busy || !scrapeQ.trim()}
                      className={`glass-btn px-3 py-2 text-sm font-medium ${
                        busy || !scrapeQ.trim() ? 'opacity-40 cursor-not-allowed glass-btn-ghost' : 'glass-btn-primary'
                      }`}>
                {busy ? 'Running…' : 'Sweep all stores'}
              </button>
            </form>
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
              Forces a live scrape across every registered merchant, bypassing the 10-minute cache.
            </p>
          </div>

          <div className="glass-card p-4">
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Backfill product images</h2>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Resolves {stats?.products - stats?.products_with_image || 0} product{(stats?.products ?? 0) - (stats?.products_with_image ?? 0) === 1 ? '' : 's'} that are missing images. The scheduler also runs this every 5 minutes automatically.
            </p>
            <button onClick={handleResolveImages} disabled={busy}
                    className={`glass-btn text-sm font-medium px-3 py-2 ${
                      busy ? 'opacity-40 cursor-not-allowed glass-btn-ghost' : 'glass-btn-primary'
                    }`}>
              {busy ? 'Working…' : 'Run one batch'}
            </button>
          </div>
        </div>
      )}

      {selected && (
        <SnapshotsPane product={selected} snapshots={snapshots} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

export default AdminView;
