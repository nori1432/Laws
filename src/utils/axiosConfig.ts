import axios from 'axios';

// Configure axios globally
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'https://lawsofsuccess.live';
axios.defaults.withCredentials = false; // Explicitly set to false for CORS compatibility
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';

// Add request interceptor to include JWT token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    console.log('🔍 Interceptor triggered for:', config.url);
    console.log('🔍 Token in localStorage:', token ? 'Token found' : 'No token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Adding token to request:', config.url);
      console.log('🔑 Authorization header set:', config.headers.Authorization);
    } else {
      console.log('❌ No token found for request:', config.url);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token might be expired or invalid
      console.log('🔓 401 Unauthorized, clearing token');
      localStorage.removeItem('access_token');
      // Optionally redirect to login or trigger logout
      if (window.location.pathname !== '/login') {
        console.log('🔓 Unauthorized, redirecting to login...');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Debug logging
console.log('🔧 Axios configured globally:', {
  baseURL: axios.defaults.baseURL,
  withCredentials: axios.defaults.withCredentials,
  interceptors: 'request/response interceptors added'
});


// No export needed - this just configures the global axios instance
