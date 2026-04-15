// src/components/search/SearchView.jsx
import React, { useRef, useState } from 'react';
import { productsApi } from '../../api';
import ProductResultCard from './ProductResultCard';

const SAMPLE_QUERIES = ['rice', 'oil', 'milk', 'tea', 'sugar', 'colgate', 'samsung', 'tissue'];

const SearchView = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const runSearch = async (raw) => {
    const q = raw.trim();
    if (!q) {
      setResults([]);
      setCount(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await productsApi.search(q);
      setResults(Array.isArray(data?.results) ? data.results : []);
      setCount(data?.count ?? 0);
    } catch (err) {
      console.warn('Search failed:', err);
      setError(
        err?.response?.status === 401
          ? 'Your session expired — sign in again.'
          : 'Search failed. Is the backend running? Check the Codespaces port 8000.',
      );
      setResults([]);
      setCount(null);
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
          One query, every merchant in the catalog. We return the cheapest and
          let you add straight to the universal cart — or track the price.
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
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && count !== null && (
        <p className="text-sm text-gray-600">
          {count === 0
            ? <>No results for <span className="font-medium">“{query}”</span>.</>
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
    </div>
  );
};

export default SearchView;
