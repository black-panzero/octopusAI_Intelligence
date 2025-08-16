// src/api.js
import axios from 'axios';

//const API_BASE_URL = 'http://localhost:8000/api/v1';

// const API_BASE_URL =
//  window.location.hostname.includes("github.dev")
//    ? `https://${window.location.hostname.replace("-3000", "-8000")}/api/v1`
//    : "http://localhost:8000/api/v1";

// const api = axios.create({ baseURL: API_BASE_URL });

const API_BASE_URL = '/api/v1';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Deals API endpoints
export const dealsApi = {
  // Create a new deal
  createDeal: async (dealData) => {
    const response = await api.post('/deals/', dealData);
    return response.data;
  },

  // Get all deals with optional query parameters
  getAllDeals: async (params = {}) => {
    const response = await api.get('/deals/', { params });
    return response.data;
  },

  // Get deal by ID
  getDealById: async (dealId) => {
    const response = await api.get(`/deals/${dealId}`);
    return response.data;
  },

  // Get deals by merchant
  getDealsByMerchant: async (merchantName) => {
    const response = await api.get(`/deals/merchant/${merchantName}`);
    return response.data;
  },

  // Get deal statistics
  getDealStats: async () => {
    const response = await api.get('/deals/stats/summary');
    return response.data;
  },
};

// Error handling interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;