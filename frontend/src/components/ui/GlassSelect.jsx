import React from 'react';

const GlassSelect = ({ label, error, children, className = '', wrapperClassName = '', ...rest }) => (
  <div className={`space-y-1.5 ${wrapperClassName}`}>
    {label && (
      <label className="block text-[var(--text-sm)] font-medium text-glass-secondary">
        {label}
      </label>
    )}
    <select
      className={`w-full glass-input px-4 py-3 text-[var(--text-base)] appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
      }}
      {...rest}
    >
      {children}
    </select>
    {error && (
      <p className="text-[var(--text-xs)] text-[var(--color-accent-rose)]">{error}</p>
    )}
  </div>
);

export default GlassSelect;
