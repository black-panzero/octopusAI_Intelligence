// src/components/charts/PriceHistoryChart.jsx
// Minimal SVG multi-series line chart — one line per merchant, shared axes.
// No charting library, so the bundle stays tiny.
import React, { useMemo } from 'react';
import { formatKES, formatDate } from '../../lib/format';

const MERCHANT_COLORS = {
  naivas:     '#2563eb',
  carrefour:  '#dc2626',
  quickmart:  '#16a34a',
  chandarana: '#9333ea',
  jumia_ke:   '#ea580c',
};
const FALLBACK_PALETTE = ['#0ea5e9', '#f59e0b', '#14b8a6', '#e11d48', '#6366f1'];
const colorFor = (slug, i) =>
  MERCHANT_COLORS[slug] || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];

const PADDING = { top: 12, right: 12, bottom: 26, left: 48 };
const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 220;

const PriceHistoryChart = ({ data, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }) => {
  const { series, ts, prices, xMin, xMax, yMin, yMax } = useMemo(() => {
    const raw = Array.isArray(data?.series) ? data.series : [];
    const tsAll = [];
    const priceAll = [];
    const cleaned = raw
      .filter((s) => Array.isArray(s.points) && s.points.length > 0)
      .map((s) => ({
        ...s,
        points: s.points
          .map((p) => ({ t: new Date(p.t).getTime(), price: Number(p.price) }))
          .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price))
          .sort((a, b) => a.t - b.t),
      }))
      .filter((s) => s.points.length > 0);

    cleaned.forEach((s) => s.points.forEach((p) => {
      tsAll.push(p.t); priceAll.push(p.price);
    }));

    const xmin = tsAll.length ? Math.min(...tsAll) : 0;
    const xmax = tsAll.length ? Math.max(...tsAll) : 0;
    const ymin = priceAll.length ? Math.min(...priceAll) : 0;
    const ymax = priceAll.length ? Math.max(...priceAll) : 1;
    return {
      series: cleaned,
      ts: tsAll,
      prices: priceAll,
      xMin: xmin, xMax: xmax,
      yMin: ymin, yMax: ymax,
    };
  }, [data]);

  if (series.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic px-2 py-6 text-center">
        No price history yet. Come back after a few live refreshes.
      </div>
    );
  }

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const xScale = (t) => {
    if (xMax === xMin) return PADDING.left + innerW / 2;
    return PADDING.left + ((t - xMin) / (xMax - xMin)) * innerW;
  };
  const yRange = yMax - yMin || Math.max(1, yMax * 0.1);
  const yPad = yRange * 0.1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;
  const yScale = (p) =>
    PADDING.top + innerH - ((p - yLo) / (yHi - yLo)) * innerH;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => yLo + ((yHi - yLo) * i) / ticks);
  const xTicks = xMax === xMin ? [xMin] :
    Array.from({ length: 4 }, (_, i) => xMin + ((xMax - xMin) * i) / 3);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full" role="img" aria-label="Price history">
        {/* grid lines */}
        {yTicks.map((v, i) => {
          const y = yScale(v);
          return (
            <g key={`h-${i}`}>
              <line x1={PADDING.left} x2={width - PADDING.right} y1={y} y2={y}
                    stroke="#e5e7eb" strokeDasharray="2 3" />
              <text x={PADDING.left - 6} y={y + 3} fontSize="10" fill="#6b7280" textAnchor="end">
                {formatKES(v)}
              </text>
            </g>
          );
        })}

        {xTicks.map((t, i) => (
          <text key={`x-${i}`}
                x={xScale(t)} y={height - 8}
                fontSize="10" fill="#6b7280" textAnchor="middle">
            {formatDate(t, { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {/* series */}
        {series.map((s, idx) => {
          const color = colorFor(s.slug, idx);
          const d = s.points.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${yScale(p.price).toFixed(1)}`
          ).join(' ');
          return (
            <g key={s.slug || idx}>
              <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={xScale(p.t)} cy={yScale(p.price)} r="2.5" fill={color}>
                  <title>{`${s.merchant}: ${formatKES(p.price)} on ${formatDate(p.t)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-3 px-2 pt-2 text-[11px] text-gray-600">
        {series.map((s, i) => (
          <span key={s.slug || i} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: colorFor(s.slug, i) }}
            />
            {s.merchant} ({s.points.length})
          </span>
        ))}
      </div>
    </div>
  );
};

export default PriceHistoryChart;
