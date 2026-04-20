// src/lib/errors.js
// Normalize any thrown/caught error into a plain string so React never tries
// to render an array of Pydantic validation errors as children (which crashes
// the entire tree and produces a blank page).
export const extractErrorMessage = (err, fallback = 'Something went wrong') => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'string' ? d : d?.msg || JSON.stringify(d)))
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || JSON.stringify(detail);
  }

  return err?.message || fallback;
};
