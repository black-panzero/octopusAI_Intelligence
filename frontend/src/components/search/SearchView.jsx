// src/components/search/SearchView.jsx
import React, { useRef, useState } from 'react';
import { productsApi } from '../../api';
import ProductResultCard from './ProductResultCard';

const SAMPLE_QUERIES = ['rice', 'oil', 'milk', 'colgate', 'samsung', 'tissue'];

// Tiny offline catalog so the UI renders even when the backend isn't reachable.
// Mirrors the three mock adapters we ship with the API. This is only used as a
// visible fallback — the real search always goes through /api/v1/products/search.
const OFFLINE_CATALOG = [
  // name, brand, category, [{merchant, price, url}]
  {
    name: 'Pishori Rice 5kg', brand: 'Mwea', category: 'Groceries',
    offers: [
      { merchant: 'Carrefour', slug: 'carrefour', price: 899 },
      { merchant: 'Naivas',    slug: 'naivas',    price: 950 },
      { merchant: 'Quickmart', slug: 'quickmart', price: 975 },
    ],
  },
  {
    name: 'Cooking Oil 1L', brand: 'Fresh Fri', category: 'Groceries',
    offers: [
      { merchant: 'Carrefour', slug: 'carrefour', price: 299 },
      { merchant: 'Quickmart', slug: 'quickmart', price: 315 },
      { merchant: 'Naivas',    slug: 'naivas',    price: 320 },
    ],
  },
  {
    name: 'Brookside Milk 500ml', brand: 'Brookside', category: 'Groceries',
    offers: [
      { merchant: 'Quickmart', slug: 'quickmart', price: 62 },
      { merchant: 'Naivas',    slug: 'naivas',    price: 65 },
      { merchant: 'Carrefour', slug: 'carrefour', price: 68 },
    ],
  },
  {
    name: 'Colgate Toothpaste 140g', brand: 'Colgate', category: 'Health & Beauty',
    offers: [
      { merchant: 'Quickmart', slug: 'quickmart', price: 260 },
      { merchant: 'Naivas',    slug: 'naivas',    price: 280 },
    ],
  },
  {
    name: 'Blue Band Margarine 500g', brand: 'Blue Band', category: 'Groceries',
    offers: [
      { merchant: 'Carrefour', slug: 'carrefour', price: 350 },
      { merchant: 'Naivas',    slug: 'naivas',    price: 360 },
    ],
  },
  {
    name: 'Omo Detergent 1kg', brand: 'Omo', category: 'Household',
    offers: [
      { merchant: 'Quickmart', slug: 'quickmart', price: 475 },
      { merchant: 'Naivas',    slug: 'naivas',    price: 490 },
    ],
  },
  {
    name: 'Tissue Paper 10pk', brand: 'Rosy', category: 'Household',
    offers: [
      { merchant: 'Quickmart', slug: 'quickmart', price: 430 },
      { merchant: 'Carrefour', slug: 'carrefour', price: 450 },
    ],
  },
  {
    name: 'Samsung Galaxy A15', brand: 'Samsung', category: 'Electronics',
    offers: [
      { merchant: 'Carrefour', slug: 'carrefour', price: 22500 },
    ],
  },
  {
    name: 'Coca-Cola 2L', brand: 'Coca-Cola', category: 'Food & Beverages',
    offers: [
      { merchant: 'Naivas',    slug: 'naivas',    price: 220 },
      { merchant: 'Carrefour', slug: 'carrefour', price: 240 },
    ],
  },
];

const offlineSearch = (query) => {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const matches = OFFLINE_CATALOG.filter((p) =>
    `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q),
  );
  return matches.map((p, idx) => {
    const offers = [...p.offers]
      .sort((a, b) => a.price - b.price)
      .map((o) => ({
        merchant: o.merchant,
        merchant_slug: o.slug,
        price: o.price,
        currency: 'KES',
        url: null,
        available: true,
        captured_at: new Date().toISOString(),
      }));
    const prices = offers.map((o) => o.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return {
      product: {
        id: `offline-${idx}`,
        canonical_name: p.name.toLowerCase(),
        display_name: p.name,
        brand: p.brand,
        category: p.category,
      },
      offers,
      min_price: min,
      max_price: max,
      best_merchant: offers[0].merchant,
      offer_count: offers.length,
      savings_pct: max > 0 && max !== min ? ((max - min) / max) * 100 : 0,
    };
  }).sort((a, b) => (b.offer_count - a.offer_count) || (a.min_price - b.min_price));
};

const SearchView = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null); // 'api' | 'offline'
  const debounceRef = useRef(null);

  const runSearch = async (raw) => {
    const q = raw.trim();
    if (!q) {
      setResults([]);
      setCount(null);
      setError(null);
      setSource(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await productsApi.search(q);
      setResults(Array.isArray(data?.results) ? data.results : []);
      setCount(data?.count ?? 0);
      setSource('api');
    } catch (err) {
      console.warn('Backend search failed — falling back to offline demo catalog:', err);
      const offline = offlineSearch(q);
      setResults(offline);
      setCount(offline.length);
      setSource('offline');
      setError(
        err?.response?.status === 401
          ? 'Your session expired — sign in again to use live data.'
          : 'Backend unreachable — showing an offline demo so you can preview the UI.',
      );
    } finally {
      setLoading(false);
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

  const handleSample = (sample) => {
    setQuery(sample);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(sample);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Compare Prices</h1>
        <p className="text-blue-100">
          One search across Naivas, Carrefour and Quickmart. Fetched in parallel,
          grouped per product, best price highlighted.
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
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">Try:</span>
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

      {loading && (
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          <span className="text-sm">Searching merchants…</span>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {!loading && count !== null && (
        <p className="text-sm text-gray-600">
          {count === 0 ? (
            <>No results for <span className="font-medium">“{query}”</span>.</>
          ) : (
            <>
              {count} matching product{count === 1 ? '' : 's'} across merchants
              {source === 'offline' && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800">
                  OFFLINE DEMO
                </span>
              )}
              {source === 'api' && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800">
                  LIVE
                </span>
              )}
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {results.map((r) => (
          <ProductResultCard key={r.product.id} result={r} />
        ))}
      </div>

      {count === null && !loading && (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
          <p className="text-sm">Type a query above or pick a sample to see cross-merchant prices.</p>
        </div>
      )}
    </div>
  );
};

export default SearchView;
