// src/stores/cartStore.js
// Thin zustand store that mirrors the backend cart response. We keep only
// the fields the UI renders; the server is the source of truth so every
// mutation round-trips through the API and replaces the cached cart.
import { create } from 'zustand';
import { cartApi } from '../api';

const empty = {
  id: null,
  items: [],
  merchant_totals: [],
  total: 0,
  item_count: 0,
  savings_vs_worst_split: 0,
  updated_at: null,
};

export const useCartStore = create((set, get) => ({
  cart: empty,
  loading: false,
  error: null,

  // Hydrate from the backend — call after login and once on app boot.
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.get();
      set({ cart, loading: false });
    } catch (err) {
      set({ error: err?.response?.data?.detail || 'Failed to load cart', loading: false });
    }
  },

  add: async ({ product_id, merchant_id, quantity = 1 }) => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.addItem({ product_id, merchant_id, quantity });
      set({ cart, loading: false });
      return cart;
    } catch (err) {
      set({ error: err?.response?.data?.detail || 'Failed to add item', loading: false });
      throw err;
    }
  },

  updateQuantity: async (item_id, quantity) => {
    const prev = get().cart;
    try {
      const cart = await cartApi.updateQuantity(item_id, quantity);
      set({ cart });
    } catch (err) {
      set({ cart: prev, error: 'Failed to update quantity' });
    }
  },

  remove: async (item_id) => {
    try {
      const cart = await cartApi.removeItem(item_id);
      set({ cart });
    } catch (err) {
      set({ error: 'Failed to remove item' });
    }
  },

  clear: async () => {
    try {
      const cart = await cartApi.clear();
      set({ cart });
    } catch (err) {
      set({ error: 'Failed to clear cart' });
    }
  },

  // Called on logout.
  reset: () => set({ cart: empty, loading: false, error: null }),
}));
