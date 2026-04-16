// src/stores/compareStore.js
// Small zustand store holding the products the user has checked for
// side-by-side comparison. Caps at 4 to keep the UI readable.
import { create } from 'zustand';

const MAX = 4;

export const useCompareStore = create((set, get) => ({
  items: [], // array of ProductSearchResult rows
  max: MAX,
  open: false,

  isSelected: (productId) => get().items.some((r) => r.product.id === productId),

  toggle: (result) => {
    const current = get().items;
    const exists = current.find((r) => r.product.id === result.product.id);
    if (exists) {
      set({ items: current.filter((r) => r.product.id !== result.product.id) });
      return;
    }
    if (current.length >= MAX) return; // silently ignore overflow
    set({ items: [...current, result] });
  },

  remove: (productId) =>
    set((s) => ({ items: s.items.filter((r) => r.product.id !== productId) })),

  clear: () => set({ items: [], open: false }),

  openView: () => set({ open: true }),
  closeView: () => set({ open: false }),
}));
