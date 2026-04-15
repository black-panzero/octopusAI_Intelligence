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
  search: async (query) => {
    const { data } = await api.get('/products/search', { params: { q: query } });
    return data; // { query, count, results: [...] }
  },
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
