import React from 'react';

const accents = {
  blue:    'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  green:   'bg-[var(--color-accent-green-soft)] text-[var(--color-accent-green)]',
  rose:    'bg-[var(--color-accent-rose-soft)] text-[var(--color-accent-rose)]',
  amber:   'bg-[var(--color-accent-amber-soft)] text-[var(--color-accent-amber)]',
  fuchsia: 'bg-[var(--color-accent-fuchsia-soft)] text-[var(--color-accent-fuchsia)]',
  ghost:   'bg-[var(--color-surface)] text-glass-secondary',
};

const GlassBadge = ({ children, color = 'blue', className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
    accents[color] || accents.blue
  } ${className}`}>
    {children}
  </span>
);

export default GlassBadge;
