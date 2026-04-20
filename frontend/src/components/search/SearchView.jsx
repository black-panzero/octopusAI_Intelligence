// src/components/search/SearchView.jsx
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { productsApi } from '../../api';
import { useCompareStore } from '../../stores/compareStore';
import { extractErrorMessage } from '../../lib/errors';
import ProductResultCard from './ProductResultCard';
import CompareView from './CompareView';

const SAMPLE_QUERIES = ['rice', 'oil', 'milk', 'tea', 'sugar', 'colgate', 'samsung', 'tissue'];

const SearchView = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const [scrapeSummary, setScrapeSummary] = useState(null);
  const debounceRef = useRef(null);

  const compareItems = useCompareStore((s) => s.items);
  const compareOpen = useCompareStore((s) => s.open);
  const openCompare = useCompareStore((s) => s.openView);
  const clearCompare = useCompareStore((s) => s.clear);
  const removeCompare = useCompareStore((s) => s.remove);

  const runSearch = async (raw, { forceLive = false } = {}) => {
    const q = raw.trim();
    if (!q) {
      setResults([]);
      setCount(null);
      setError(null);
      setScrapeSummary(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await productsApi.search(q, { live: forceLive || live });
      setResults(Array.isArray(data?.results) ? data.results : []);
      setCount(data?.count ?? 0);
    } catch (err) {
      setError(extractErrorMessage(err, 'Search failed. Is the backend running?'));
      setResults([]);
      setCount(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshLive = async () => {
    const q = query.trim();
    if (!q) {
      toast.error('Type a query to refresh');
      return;
    }
    setRefreshing(true);
    try {
      const summary = await productsApi.refresh(q);
      setScrapeSummary(summary);
      const succeeded = (summary?.per_scraper || []).filter((s) => s.ok).length;
      const total = (summary?.scrapers_ran || []).length;
      const offers = summary?.offers_persisted || 0;
      if (offers > 0) {
        toast.success(`Found ${offers} fresh offer${offers === 1 ? '' : 's'} across ${succeeded}/${total} stores`);
      } else {
        toast(`Checked ${total} stores — try a broader search`);
      }
      await runSearch(q, { forceLive: false });  // results are now fresh in the DB
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Live refresh failed'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 400);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  };

  const handleSample = (s) => {
    setQuery(s);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(s);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 text-white" style={{ background: 'var(--brand-gradient)' }}>
        <h1 className="text-2xl font-bold mb-2">Compare Prices</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)' }}>
          One query, every merchant. Cached results are instant — toggle{' '}
          <span className="font-semibold">Live</span> or hit{' '}
          <span className="font-semibold">Refresh live</span> to scrape Naivas,
          Carrefour, Quickmart and Jumia Kenya right now.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={handleChange}
            placeholder="Search for rice, oil, milk…"
            className="glass-input w-full pl-10 pr-3 py-3"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <button
          type="submit"
          className="glass-btn glass-btn-primary px-4 py-3 font-medium"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleRefreshLive}
          disabled={refreshing || !query.trim()}
          className={`glass-btn inline-flex items-center gap-1.5 px-4 py-3 font-medium ${
            refreshing || !query.trim()
              ? 'opacity-40 cursor-not-allowed glass-btn-ghost'
              : 'text-white'
          }`}
          style={!(refreshing || !query.trim()) ? { background: 'var(--color-fuchsia)' } : {}}
          title="Scrape live merchants and refresh results"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 4v6h6M20 20v-6h-6M5.4 15a7 7 0 0012.3 2.2M18.6 9A7 7 0 006.3 6.8" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh live'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            className="rounded"
            style={{ accentColor: 'var(--color-fuchsia)' }}
          />
          <span>Always hit live merchants</span>
        </label>
        <span style={{ color: 'var(--text-tertiary)' }}>Try:</span>
        {SAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => handleSample(q)}
            className="glass-btn glass-btn-surface text-sm px-3 py-1 rounded-full"
          >
            {q}
          </button>
        ))}
      </div>

      {scrapeSummary && (() => {
        const per = scrapeSummary.per_scraper || [];
        const ok = per.filter((s) => s.ok);
        const total = per.length;
        const okCount = ok.length;
        const offersTotal = ok.reduce((acc, s) => acc + (s.count || 0), 0);

        return (
          <div className="glass-card p-3 text-xs" style={{ background: 'var(--color-purple-soft)', color: 'var(--color-purple)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="font-semibold">
                {okCount > 0
                  ? `Checked ${total} Kenyan stores · ${offersTotal} fresh offer${offersTotal === 1 ? '' : 's'} from ${okCount}`
                  : `Swept ${total} Kenyan stores · nothing new surfaced`}
              </p>
              {scrapeSummary.cached && (
                <span className="text-[10px] uppercase tracking-wide badge-purple px-1.5 py-0.5 rounded">
                  Cached
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {per.map((s) => (
                <span
                  key={s.slug}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
                    s.ok
                      ? 'badge-green'
                      : 'glass-subtle'
                  }`}
                  style={!s.ok ? { color: 'var(--text-tertiary)' } : {}}
                  title={s.ok ? `${s.count} offers` : 'Quiet this round'}
                >
                  {s.slug.replace(/_/g, ' ')}{s.ok ? ` · ${s.count}` : ''}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {loading && (
        <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
          <span className="text-sm">Searching merchants…</span>
        </div>
      )}

      {error && (
        <div className="glass-card p-3 text-sm" style={{ background: 'var(--color-red-soft)', borderColor: 'var(--color-red)', color: 'var(--color-red)' }}>
          {error}
        </div>
      )}

      {!loading && count !== null && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {count === 0
            ? <>No results for <span className="font-medium">"{query}"</span>. Try <b>Refresh live</b>.</>
            : <>{count} matching product{count === 1 ? '' : 's'} across merchants</>}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {results.map((r) => (
          <ProductResultCard key={r.product.id} result={r} />
        ))}
      </div>

      {count === null && !loading && !error && (
        <div className="glass-card p-8 text-center" style={{ borderStyle: 'dashed', color: 'var(--text-tertiary)' }}>
          <p className="text-sm">Type a query above or pick a sample to see cross-merchant prices.</p>
        </div>
      )}

      {compareItems.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 glass-heavy glass-border glass-shadow-lg rounded-full px-4 py-2 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
          <span className="text-sm">{compareItems.length} selected</span>
          <div className="flex items-center gap-1">
            {compareItems.map((r) => (
              <button
                key={r.product.id}
                onClick={() => removeCompare(r.product.id)}
                className="text-[10px] glass-subtle rounded-full px-2 py-0.5"
              >
                {r.product.display_name.slice(0, 20)} ✕
              </button>
            ))}
          </div>
          <button
            onClick={openCompare}
            disabled={compareItems.length < 2}
            className={`glass-btn text-sm font-semibold px-3 py-1 rounded-full ${
              compareItems.length < 2 ? 'opacity-40 cursor-not-allowed glass-btn-ghost' : 'glass-btn-brand'
            }`}
          >
            Compare →
          </button>
          <button onClick={clearCompare} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Clear</button>
        </div>
      )}

      {compareOpen && <CompareView />}
    </div>
  );
};

export default SearchView;
