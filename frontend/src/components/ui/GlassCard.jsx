import React from 'react';

const variants = {
  default:  'glass glass-border glass-inset',
  heavy:    'glass-heavy glass-border glass-inset',
  elevated: 'glass-elevated',
  card:     'glass-card',
  solid:    'glass-solid glass-border glass-inset',
  subtle:   'glass-subtle glass-border',
};

const GlassCard = ({
  children,
  className = '',
  variant = 'card',
  padding = 'p-5',
  radius = 'rounded-[var(--r-lg)]',
  onClick,
  ...rest
}) => (
  <div
    className={`${radius} ${variants[variant] || variants.card} ${padding} ${
      onClick ? 'cursor-pointer glass-hover' : ''
    } ${className}`}
    onClick={onClick}
    {...rest}
  >
    {children}
  </div>
);

export default GlassCard;
