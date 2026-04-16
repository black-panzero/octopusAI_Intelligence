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
// Admin (superuser only)
// -----------------------------
export const adminApi = {
  stats: async () => (await api.get('/admin/stats')).data,
  merchants: async () => (await api.get('/admin/merchants')).data,
  products: async ({ page = 1, size = 30, q = '', missing_image = false } = {}) => {
    const params = { page, size, missing_image };
    if (q) params.q = q;
    return (await api.get('/admin/products', { params })).data;
  },
  snapshots: async (productId, limit = 100) =>
    (await api.get(`/admin/products/${productId}/snapshots`, { params: { limit } })).data,
  scrape: async (q) =>
    (await api.post('/admin/scrape', null, { params: { q } })).data,
  resolveImages: async (batch_size = 30) =>
    (await api.post('/admin/resolve-images', null, { params: { batch_size } })).data,
};

// -----------------------------
// Shopping lists / wishlists
// -----------------------------
export const shoppingListsApi = {
  list: async ({ kind = null, include_archived = false } = {}) => {
    const params = { include_archived };
    if (kind) params.kind = kind;
    return (await api.get('/shopping-lists/', { params })).data;
  },
  get: async (id) => (await api.get(`/shopping-lists/${id}`)).data,
  create: async (payload) =>
    (await api.post('/shopping-lists/', payload)).data,
  patch: async (id, patch) =>
    (await api.patch(`/shopping-lists/${id}`, patch)).data,
  delete: async (id) => (await api.delete(`/shopping-lists/${id}`)).data,
  addItem: async (id, payload) =>
    (await api.post(`/shopping-lists/${id}/items`, payload)).data,
  updateItem: async (id, itemId, patch) =>
    (await api.patch(`/shopping-lists/${id}/items/${itemId}`, patch)).data,
  removeItem: async (id, itemId) =>
    (await api.delete(`/shopping-lists/${id}/items/${itemId}`)).data,
  sendToCart: async (id) =>
    (await api.post(`/shopping-lists/${id}/send-to-cart`)).data,
};

// -----------------------------
// Chat / AI assistant
// -----------------------------
export const chatApi = {
  status: async () => (await api.get('/chat/status')).data,
  send: async (messages, { conversation_id = null } = {}) =>
    (await api.post('/chat/', { messages, conversation_id })).data,
  listConversations: async () => (await api.get('/chat/conversations')).data,
  getConversation: async (id) => (await api.get(`/chat/conversations/${id}`)).data,
  deleteConversation: async (id) => (await api.delete(`/chat/conversations/${id}`)).data,
  renameConversation: async (id, title) =>
    (await api.patch(`/chat/conversations/${id}`, { title })).data,
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
