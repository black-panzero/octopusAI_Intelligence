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
    blue:   'text-blue-600',
    green:  'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    rose:   'text-rose-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accents[accent] || accents.blue}`}>
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Image coverage</p>
          <p className="text-xs text-gray-500">
            {stats.products_with_image} of {stats.products} products have an image ({coverage}%).
          </p>
        </div>
        <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${coverage}%` }} />
        </div>
      </div>
    </>
  );
};

const MerchantsTable = ({ rows }) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Slug</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Name</th>
          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Base URL</th>
          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Snapshots</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id} className="border-t border-gray-100">
            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{m.slug}</td>
            <td className="px-3 py-2 font-medium text-gray-900">{m.name}</td>
            <td className="px-3 py-2">
              {m.base_url && (
                <a href={m.base_url} target="_blank" rel="noopener noreferrer"
                   className="text-blue-600 hover:text-blue-800 text-xs truncate max-w-xs inline-block">
                  {m.base_url}
                </a>
              )}
            </td>
            <td className="px-3 py-2 text-right text-gray-700">{m.snapshot_count.toLocaleString('en-KE')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ProductRow = ({ product, onOpen }) => (
  <button
    onClick={() => onOpen(product)}
    className="w-full text-left border-t border-gray-100 hover:bg-gray-50 grid grid-cols-12 gap-2 items-center p-2"
  >
    <div className="col-span-1">
      {product.image_url ? (
        <img src={product.image_url} alt=""
             className="w-10 h-10 object-cover rounded bg-gray-100"
             loading="lazy"
             onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
      ) : (
        <div className="w-10 h-10 bg-gray-100 rounded" />
      )}
    </div>
    <div className="col-span-5 min-w-0">
      <p className="text-sm text-gray-900 truncate">{product.display_name}</p>
      <p className="text-[11px] text-gray-500 truncate">
        {[product.brand, product.category, product.size].filter(Boolean).join(' • ')}
      </p>
    </div>
    <div className="col-span-2 text-xs text-gray-600 truncate">
      {product.rating != null ? `★ ${product.rating} (${product.review_count ?? 0})` : '—'}
    </div>
    <div className="col-span-2 text-xs text-gray-500 truncate">
      {product.specs_keys.length ? `${product.specs_keys.length} specs` : '—'}
    </div>
    <div className="col-span-2 text-xs text-gray-500 truncate text-right">
      {formatDate(product.updated_at)}
    </div>
  </button>
);

const SnapshotsPane = ({ product, snapshots, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
         onClick={(e) => e.stopPropagation()}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Product</p>
          <p className="text-lg font-semibold text-gray-900 truncate">{product.display_name}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-900">✕</button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Merchant</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Price</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Captured</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">URL</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{s.merchant}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-800">{formatKES(s.price)}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{formatDate(s.captured_at, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-3 py-2 text-xs">
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 truncate max-w-xs inline-block">
                      {s.url}
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {snapshots.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No snapshots captured yet.</td></tr>
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
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Admin</h1>
        <p className="text-slate-300 text-sm">
          Catalog inspection and control. Use with care — actions here hit real merchants.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['overview', 'merchants', 'products', 'operations'].map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`text-sm px-3 py-1.5 rounded-full capitalize ${
              section === s ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={missingImage}
                     onChange={(e) => setMissingImage(e.target.checked)}
                     className="rounded" />
              Missing image only
            </label>
            <span className="text-xs text-gray-500 ml-auto">{products.total.toLocaleString('en-KE')} total</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {(products.items || []).map((p) => (
              <ProductRow key={p.id} product={p} onOpen={handleOpen} />
            ))}
            {products.items.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">No products.</p>
            )}
          </div>

          {products.total > products.size && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => loadProducts(Math.max(1, products.page - 1))}
                disabled={products.page <= 1}
                className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >← Prev</button>
              <span className="text-xs text-gray-500 self-center">
                Page {products.page} / {Math.ceil(products.total / products.size)}
              </span>
              <button
                onClick={() => loadProducts(products.page + 1)}
                disabled={products.page * products.size >= products.total}
                className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              >Next →</button>
            </div>
          )}
        </>
      )}

      {section === 'operations' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Manual scrape</h2>
            <form onSubmit={handleScrape} className="flex gap-2">
              <input
                value={scrapeQ}
                onChange={(e) => setScrapeQ(e.target.value)}
                placeholder="e.g. rice, samsung, cooking oil"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
              <button type="submit" disabled={busy || !scrapeQ.trim()}
                      className={`px-3 py-2 rounded-md text-sm font-medium text-white ${
                        busy || !scrapeQ.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'
                      }`}>
                {busy ? 'Running…' : 'Sweep all stores'}
              </button>
            </form>
            <p className="text-[11px] text-gray-500 mt-2">
              Forces a live scrape across every registered merchant, bypassing the 10-minute cache.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Backfill product images</h2>
            <p className="text-xs text-gray-500 mb-2">
              Resolves {stats?.products - stats?.products_with_image || 0} product{(stats?.products ?? 0) - (stats?.products_with_image ?? 0) === 1 ? '' : 's'} that are missing images. The scheduler also runs this every 5 minutes automatically.
            </p>
            <button onClick={handleResolveImages} disabled={busy}
                    className={`text-sm font-medium px-3 py-2 rounded-md ${
                      busy ? 'bg-gray-200 text-gray-500' : 'bg-slate-900 text-white hover:bg-slate-800'
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
