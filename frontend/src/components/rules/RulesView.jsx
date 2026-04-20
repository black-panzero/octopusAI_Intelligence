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
      <div className="glass-card p-6 text-white" style={{ background: 'var(--brand-gradient)' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Price Tracking &amp; Rules</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Track products you care about. Set a target price to get alerted —
              or to auto-add to your cart when a merchant drops below it.
            </p>
          </div>
          <button
            onClick={handleEvaluate}
            disabled={evaluating || rules.length === 0}
            className={`glass-btn inline-flex items-center gap-2 px-4 py-2 font-semibold shadow ${
              evaluating || rules.length === 0
                ? 'glass-btn-ghost opacity-60 cursor-not-allowed'
                : 'glass-btn-surface'
            }`}
          >
            {evaluating ? 'Evaluating…' : 'Evaluate now'}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading rules…</p>}
      {error && (
        <div className="glass-card p-3 text-sm" style={{ background: 'var(--color-red-soft)', borderColor: 'var(--color-red)', color: 'var(--color-red)' }}>
          {error}
        </div>
      )}

      {!loading && rules.length === 0 && (
        <div className="glass-card p-10 text-center" style={{ borderStyle: 'dashed' }}>
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>You aren't tracking anything yet.</p>
          <button
            onClick={() => onNavigate?.('search')}
            className="glass-btn glass-btn-primary inline-flex items-center gap-2 px-4 py-2"
          >
            Find something to track
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((r) => (
          <div
            key={r.id}
            className={`glass-card p-4 ${
              r.triggered ? 'ring-1' : ''
            }`}
            style={r.triggered ? { borderColor: 'var(--color-green)', boxShadow: '0 0 0 1px var(--color-green-soft)' } : {}}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.product_name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {[r.brand, r.category].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  r.action === 'add_to_cart'
                    ? 'badge-purple'
                    : 'badge-amber'
                }`}
              >
                {r.action === 'add_to_cart' ? 'Auto add' : 'Alert'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Target</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {r.target_price != null ? formatKES(r.target_price) : 'Track only'}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Current best</p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {r.current_price != null ? formatKES(r.current_price) : '—'}
                  {r.current_merchant && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}> @ {r.current_merchant}</span>
                  )}
                </p>
              </div>
            </div>

            {r.triggered && (
              <div className="mt-3 badge-green rounded-[var(--r-md)] px-2 py-1.5 text-xs">
                ✓ Below target — hit "Evaluate now" to execute.
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => handleToggleHistory(r)}
                className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}
              >
                {historyOpenFor === r.id ? '▲ Hide history' : '📈 View history'}
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                className="text-xs" style={{ color: 'var(--color-red)' }}
              >
                Remove
              </button>
            </div>

            {historyOpenFor === r.id && (
              <div className="mt-3 pt-3">
                <div className="glass-divider mb-3"></div>
                {historyLoading && (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading price history…</p>
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
