// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lawsofsuccess.live';

// Debug: Log the API URL to console (remove in production)
console.log('🔗 API Base URL:', API_BASE_URL);

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  VERIFY_EMAIL: '/api/auth/verify-email',
  ME: '/api/auth/me',
  UPDATE_PROFILE: '/api/auth/me/profile',
  VALIDATE_BARCODE: '/api/auth/validate-barcode',
  BARCODE_LOGIN: '/api/auth/barcode-login',
  BARCODE_SETUP_LOGIN: '/api/auth/barcode-setup-login',

  // Courses
  COURSES: '/api/courses',
  COURSE_DETAIL: (id: number) => `/api/courses/${id}`,

  // Admin
  ADMIN_USERS: '/api/admin/users',
  ADMIN_COURSES: '/api/admin/courses',
  ADMIN_ATTENDANCE: '/api/admin/attendance',

  // Contact
  CONTACT: '/api/contact',

  // Health Check & CORS Test
  HEALTH: '/api/health',
  CORS_TEST: '/api/cors-test',
};

// Create API instance for making requests
export const api = {
  baseURL: API_BASE_URL,
  endpoints: API_ENDPOINTS,
  
  // Helper method to make requests with better CORS handling
  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'omit', // Don't send credentials for CORS compatibility
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 Network/CORS Error:', error);
        throw new Error('Network error - check if backend is running and CORS is configured');
      }
      throw error;
    }
  },

  // Test CORS connectivity
  async testCors() {
    return this.request('/api/cors-test');
  },
  
  // Convenience methods
  get(endpoint: string, options: RequestInit = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },
  
  post(endpoint: string, data?: any, options: RequestInit = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  put(endpoint: string, data?: any, options: RequestInit = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  delete(endpoint: string, options: RequestInit = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
};

export { API_BASE_URL };

