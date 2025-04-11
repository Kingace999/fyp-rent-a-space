// src/services/api.js
import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true // Important for cookies
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Get token from session storage
    const token = sessionStorage.getItem('accessToken');
    
    // Add auth header if token exists
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// API endpoints
export const authAPI = {
  signup: (userData) => api.post('/auth/signup', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  getProfile: () => api.get('/auth/user/profile')
};

export const listingAPI = {
  getListings: (params) => api.get('/listings', { params }),
  getListing: (id) => api.get(`/listings/${id}`),
  createListing: (data, config) => api.post('/listings', data, config),
  updateListing: (id, data) => api.put(`/listings/${id}`, data),
  deleteListing: (id) => api.delete(`/listings/${id}`),
  getMyListings: () => api.get('/listings/user')
};

export const bookingAPI = {
  getBookings: () => api.get('/bookings/user'),
  createBooking: (data) => api.post('/bookings', data),
  getBooking: (id) => api.get(`/bookings/${id}`),
  cancelBooking: (id) => api.post(`/payments/refund/${id}`)
};

export const profileAPI = {
  updateProfile: (data) => api.put('/profile', data),
  uploadProfileImage: (formData) => api.post('/profile/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export default api;