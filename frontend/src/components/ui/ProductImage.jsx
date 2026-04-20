import React, { useState } from 'react';

const sizeMap = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
  '2xl': 'w-36 h-36',
};

const ProductImage = ({ src, alt = '', size = 'md', className = '' }) => {
  const [failed, setFailed] = useState(false);
  const dim = sizeMap[size] || sizeMap.md;

  if (!src || failed) {
    return (
      <div className={`${dim} rounded-[var(--r-md)] bg-white/60 flex items-center justify-center flex-shrink-0 ${className}`}
           style={{ color: 'var(--text-tertiary)' }}>
        <svg className="w-1/2 h-1/2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`${dim} rounded-[var(--r-md)] object-cover bg-white/80 flex-shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

export default ProductImage;
