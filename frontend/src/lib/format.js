// src/lib/format.js
// Shared formatters for the Kenya-first SmartBuy UI.

export const formatKES = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(n);
};

export const formatDate = (input, opts = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-KE', opts);
};

/**
 * Given a base price and a discount (percent if 0-100, fixed amount otherwise),
 * return {final, savings, percent} aligned with the backend computation.
 */
export const computeDiscount = (price, discount) => {
  const p = Number(price) || 0;
  if (discount === null || discount === undefined || discount === '' || Number(discount) <= 0) {
    return { final: p, savings: 0, percent: 0 };
  }
  const d = Number(discount);
  let final;
  if (d > 0 && d <= 100) {
    final = p * (1 - d / 100);
  } else {
    final = Math.max(0, p - d);
  }
  const savings = Math.max(0, p - final);
  const percent = p > 0 ? (savings / p) * 100 : 0;
  return { final, savings, percent };
};

// Kenyan merchants used across filters and forms.
export const formatRating = (rating, reviewCount) => {
  if (rating == null) return '—';
  const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  const count = reviewCount != null ? ` (${reviewCount.toLocaleString('en-KE')})` : '';
  return `${stars} ${Number(rating).toFixed(1)}${count}`;
};

export const KENYA_MERCHANTS = [
  'Naivas',
  'Carrefour',
  'Quickmart',
  'Chandarana',
  'Jumia KE',
  'Kilimall',
  'Masoko',
  'Glovo',
  'Other',
];

export const DEAL_CATEGORIES = [
  'Groceries',
  'Household',
  'Electronics',
  'Fashion',
  'Health & Beauty',
  'Home & Garden',
  'Sports & Outdoors',
  'Books',
  'Toys',
  'Food & Beverages',
  'Other',
];
