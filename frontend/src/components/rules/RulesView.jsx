// src/components/rules/RulesView.jsx
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { productsApi, rulesApi } from '../../api';
import { formatKES } from '../../lib/format';
import { extractErrorMessage } from '../../lib/errors';
import PriceHistoryChart from '../charts/PriceHistoryChart';

const RulesView = ({ onNavigate }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState(null);

  const [historyOpenFor, setHistoryOpenFor] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await rulesApi.list();
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load rules'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    try {
      const next = await rulesApi.delete(id);
      setRules(Array.isArray(next) ? next : []);
      toast.success('Rule removed');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not delete rule'));
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const { triggered } = await rulesApi.evaluate();
      if (triggered.length === 0) toast('No rules triggered right now');
      else toast.success(`${triggered.length} rule${triggered.length === 1 ? '' : 's'} triggered`);
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Evaluation failed'));
    } finally {
      setEvaluating(false);
    }
  };

  const handleToggleHistory = async (rule) => {
    if (historyOpenFor === rule.id) {
      setHistoryOpenFor(null);
      setHistoryData(null);
      return;
    }
    setHistoryOpenFor(rule.id);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const data = await productsApi.history(rule.product_id);
      setHistoryData(data);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not load history'));
      setHistoryOpenFor(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Price Tracking &amp; Rules</h1>
            <p className="text-emerald-100 text-sm">
              Track products you care about. Set a target price to get alerted —
              or to auto-add to your cart when a merchant drops below it.
            </p>
          </div>
          <button
            onClick={handleEvaluate}
            disabled={evaluating || rules.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow ${
              evaluating || rules.length === 0
                ? 'bg-white/60 text-emerald-900 cursor-not-allowed'
                : 'bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {evaluating ? 'Evaluating…' : 'Evaluate now'}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading rules…</p>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && rules.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
          <p className="text-gray-600 mb-4">You aren't tracking anything yet.</p>
          <button
            onClick={() => onNavigate?.('search')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Find something to track
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((r) => (
          <div
            key={r.id}
            className={`bg-white rounded-lg border p-4 ${
              r.triggered ? 'border-green-400 ring-1 ring-green-300' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{r.product_name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {[r.brand, r.category].filter(Boolean).join(' • ') || '—'}
                </p>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  r.action === 'add_to_cart'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {r.action === 'add_to_cart' ? 'Auto add' : 'Alert'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Target</p>
                <p className="font-medium text-gray-900">
                  {r.target_price != null ? formatKES(r.target_price) : 'Track only'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Current best</p>
                <p className="font-medium text-gray-900">
                  {r.current_price != null ? formatKES(r.current_price) : '—'}
                  {r.current_merchant && (
                    <span className="text-gray-500 text-xs"> @ {r.current_merchant}</span>
                  )}
                </p>
              </div>
            </div>

            {r.triggered && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded px-2 py-1.5 text-xs text-green-800">
                ✓ Below target — hit "Evaluate now" to execute.
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => handleToggleHistory(r)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                {historyOpenFor === r.id ? '▲ Hide history' : '📈 View history'}
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>

            {historyOpenFor === r.id && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                {historyLoading && (
                  <p className="text-xs text-gray-500">Loading price history…</p>
                )}
                {!historyLoading && historyData && (
                  <PriceHistoryChart data={historyData} width={520} height={200} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RulesView;
