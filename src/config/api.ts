// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

  // Courses
  COURSES: '/api/courses',
  COURSE_DETAIL: (id: number) => `/api/courses/${id}`,

  // Admin
  ADMIN_USERS: '/api/admin/users',
  ADMIN_COURSES: '/api/admin/courses',
  ADMIN_ATTENDANCE: '/api/admin/attendance',

  // Contact
  CONTACT: '/api/contact',

  // Health Check
  HEALTH: '/api/health',
};

export { API_BASE_URL };
