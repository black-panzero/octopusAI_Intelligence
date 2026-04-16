import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

const GlassModal = ({ isOpen, onClose, title, children, className = '', maxWidth = 'max-w-2xl' }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className={`relative w-full ${maxWidth} glass-card overflow-hidden ${className}`}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-4 glass-border-b">
              <h2 className="text-[var(--text-lg)] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full glass glass-border flex items-center justify-center transition-colors hover:bg-[var(--glass-bg-heavy)]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="overflow-y-auto max-h-[70vh] glass-scroll">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default GlassModal;
