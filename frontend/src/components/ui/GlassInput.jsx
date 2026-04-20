import React, { forwardRef } from 'react';

const GlassInput = forwardRef(({
  label,
  error,
  icon,
  className = '',
  wrapperClassName = '',
  ...rest
}, ref) => (
  <div className={`space-y-1.5 ${wrapperClassName}`}>
    {label && (
      <label className="block text-[var(--text-sm)] font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
    )}
    <div className="relative">
      {icon && (
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
             style={{ color: 'var(--text-tertiary)' }}>
          {icon}
        </div>
      )}
      <input
        ref={ref}
        className={`w-full glass-input px-4 py-3 text-[var(--text-base)] ${
          icon ? 'pl-11' : ''
        } ${error ? 'border-[var(--color-red)]' : ''} ${className}`}
        {...rest}
      />
    </div>
    {error && (
      <p className="text-[var(--text-xs)]" style={{ color: 'var(--color-red)' }}>{error}</p>
    )}
  </div>
));

GlassInput.displayName = 'GlassInput';
export default GlassInput;
