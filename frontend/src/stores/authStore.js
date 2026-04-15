// src/stores/authStore.js
// Zustand auth store, persisted to localStorage so refresh doesn't log the user out.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,

      setSession: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'smartbuy-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);

// Non-hook accessor for use inside interceptors / API helpers.
export const getAuth = () => useAuthStore.getState();
