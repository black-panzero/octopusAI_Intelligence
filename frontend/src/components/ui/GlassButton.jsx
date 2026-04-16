import React from 'react';

const variantMap = {
  primary: 'glass-btn glass-btn-primary',
  brand:   'glass-btn glass-btn-brand',
  cta:     'glass-btn glass-btn-cta',
  ghost:   'glass-btn glass-btn-ghost',
  surface: 'glass-btn glass-btn-surface',
  danger:  'glass-btn bg-[var(--color-red)] text-white shadow-sm hover:shadow-md hover:-translate-y-px',
};

const sizeMap = {
  xs: 'px-2.5 py-1 text-[var(--text-xs)]',
  sm: 'px-3 py-1.5 text-[var(--text-sm)]',
  md: 'px-4 py-2.5 text-[var(--text-base)]',
  lg: 'px-6 py-3 text-[var(--text-lg)]',
  xl: 'px-8 py-3.5 text-[var(--text-xl)]',
};

const GlassButton = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon,
  ...rest
}) => (
  <button
    className={`${variantMap[variant] || variantMap.primary} ${sizeMap[size] || sizeMap.md} ${className}`}
    disabled={disabled || loading}
    {...rest}
  >
    {loading && (
      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
    )}
    {!loading && icon}
    {children}
  </button>
);

export default GlassButton;
