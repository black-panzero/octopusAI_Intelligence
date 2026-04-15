// src/api.js
import axios from 'axios';
import { getAuth, useAuthStore } from './stores/authStore';

const API_BASE_URL = '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach bearer token on every request when we have one.
api.interceptors.request.use((config) => {
  const { token } = getAuth();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 (expired / invalid token), drop the session so the UI shows the login screen.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const { token, logout } = useAuthStore.getState();
      if (token) logout();
    }
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  },
);

// -----------------------------
// Auth
// -----------------------------
export const authApi = {
  register: async ({ email, password, full_name }) => {
    const { data } = await api.post('/auth/register', { email, password, full_name });
    return data;
  },

  // /auth/login is OAuth2 password-flow compatible → form-encoded body
  login: async ({ email, password }) => {
    const body = new URLSearchParams();
    body.append('username', email);
    body.append('password', password);
    const { data } = await api.post('/auth/login', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data; // { access_token, token_type, expires_in, user }
  },

  me: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

// -----------------------------
// Products (cross-merchant search)
// -----------------------------
export const productsApi = {
  search: async (query, { live = false } = {}) => {
    const params = { q: query };
    if (live) params.live = true;
    const { data } = await api.get('/products/search', { params });
    return data;
  },
  refresh: async (query) => {
    const { data } = await api.post('/products/refresh', null, { params: { q: query } });
    return data;
  },
  history: async (product_id) => {
    const { data } = await api.get(`/products/${product_id}/history`);
    return data;
  },
};

// -----------------------------
// Recommendations (Dashboard)
// -----------------------------
export const recommendationsApi = {
  get: async () => (await api.get('/recommendations/')).data,
};

// -----------------------------
// Chat / AI assistant
// -----------------------------
export const chatApi = {
  status: async () => (await api.get('/chat/status')).data,
  send: async (messages) =>
    (await api.post('/chat/', { messages })).data,
};

// -----------------------------
// Cart
// -----------------------------
export const cartApi = {
  get: async () => (await api.get('/cart/')).data,
  addItem: async ({ product_id, merchant_id, quantity = 1 }) =>
    (await api.post('/cart/items', { product_id, merchant_id, quantity })).data,
  updateQuantity: async (item_id, quantity) =>
    (await api.patch(`/cart/items/${item_id}`, { quantity })).data,
  removeItem: async (item_id) =>
    (await api.delete(`/cart/items/${item_id}`)).data,
  clear: async () => (await api.delete('/cart/')).data,
};

// -----------------------------
// Rules (price tracking + automation)
// -----------------------------
export const rulesApi = {
  list: async () => (await api.get('/rules/')).data,
  create: async ({ product_id, action = 'alert', target_price = null }) =>
    (await api.post('/rules/', { product_id, action, target_price })).data,
  delete: async (rule_id) => (await api.delete(`/rules/${rule_id}`)).data,
  evaluate: async () => (await api.post('/rules/evaluate')).data,
};

// -----------------------------
// Deals
// -----------------------------
export const dealsApi = {
  createDeal: async (dealData) => {
    const { data } = await api.post('/deals/', dealData);
    return data;
  },
  getAllDeals: async (params = {}) => {
    const { data } = await api.get('/deals/', { params });
    return data;
  },
  getDealById: async (dealId) => {
    const { data } = await api.get(`/deals/${dealId}`);
    return data;
  },
  getDealsByMerchant: async (merchantName) => {
    const { data } = await api.get(`/deals/merchant/${merchantName}`);
    return data;
  },
  getDealStats: async () => {
    const { data } = await api.get('/deals/stats/summary');
    return data;
  },
};

export default api;
