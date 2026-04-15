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
      toast.success(`Scraped ${succeeded}/${total} merchants — ${summary?.offers_persisted || 0} offers`);
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
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Compare Prices</h1>
        <p className="text-blue-100">
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
            className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleRefreshLive}
          disabled={refreshing || !query.trim()}
          className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-md font-medium ${
            refreshing || !query.trim()
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
          }`}
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
        <label className="inline-flex items-center gap-1.5 text-gray-700">
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            className="rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
          />
          <span>Always hit live merchants</span>
        </label>
        <span className="text-gray-500">Try:</span>
        {SAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => handleSample(q)}
            className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-800"
          >
            {q}
          </button>
        ))}
      </div>

      {scrapeSummary && (
        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-md p-3 text-xs text-fuchsia-800">
          <p className="font-semibold mb-1">Live scrape summary</p>
          <div className="flex flex-wrap gap-2">
            {(scrapeSummary.per_scraper || []).map((s) => (
              <span
                key={s.slug}
                className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                  s.ok
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s.slug}: {s.ok ? `${s.count} offers` : 'no data'}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          <span className="text-sm">Searching merchants…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && count !== null && (
        <p className="text-sm text-gray-600">
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
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
          <p className="text-sm">Type a query above or pick a sample to see cross-merchant prices.</p>
        </div>
      )}

      {compareItems.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-full shadow-xl px-4 py-2 flex items-center gap-3">
          <span className="text-sm">{compareItems.length} selected</span>
          <div className="flex items-center gap-1">
            {compareItems.map((r) => (
              <button
                key={r.product.id}
                onClick={() => removeCompare(r.product.id)}
                className="text-[10px] bg-white/10 hover:bg-white/20 rounded-full px-2 py-0.5"
              >
                {r.product.display_name.slice(0, 20)} ✕
              </button>
            ))}
          </div>
          <button
            onClick={openCompare}
            disabled={compareItems.length < 2}
            className={`text-sm font-semibold px-3 py-1 rounded-full ${
              compareItems.length < 2 ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600'
            }`}
          >
            Compare →
          </button>
          <button onClick={clearCompare} className="text-xs text-gray-300 hover:text-white">Clear</button>
        </div>
      )}

      {compareOpen && <CompareView />}
    </div>
  );
};

export default SearchView;
