import axios from 'axios';
import { getToken } from './tokenUtils';

// Create axios instance with interceptor to automatically add Authorization header
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Request interceptor to add Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401/403 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const { getToken, removeToken } = require('./tokenUtils');
      const hasToken = getToken();
      
      // Only clear token and redirect if there was a token (invalid token)
      // If no token, it's an anonymous user - this is normal, don't redirect
      if (hasToken) {
        // Token is invalid - clear it
        removeToken();
        
        // Only redirect to login if accessing dashboard routes
        // For other routes, anonymous access is allowed
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          if (pathname.startsWith('/dashboard') && !pathname.includes('/auth/login')) {
            window.location.href = '/auth/login?redirect=' + encodeURIComponent(pathname);
          }
        }
      }
      // If no token, just let the error pass through - it's expected for anonymous users
    }
    return Promise.reject(error);
  }
);

export default apiClient;
