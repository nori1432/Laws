import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE_URL, API_ENDPOINTS, api } from '../config/api';

interface User {
  id: number;
  email?: string;
  full_name: string;
  phone: string;
  role: 'client' | 'admin';
  email_verified: boolean;
  profile_picture_url?: string | null;
  mobile_username?: string;
  mobile_password?: string;
  mobile_app_enabled: boolean;
  profile_incomplete?: boolean;
  gender?: string;
  students?: Array<{
    id: number;
    name: string;
    date_of_birth?: string;
    phone?: string;
    mobile_username?: string;
    mobile_password?: string;
    mobile_app_enabled?: boolean;
  }>;
  parent_info?: {
    full_name?: string;
    phone?: string;
    email?: string;
  };
}

interface AuthContextType {
  user: User | null;
  login: (credentials: { email?: string; phone?: string; password: string }) => Promise<User>;
  logout: () => void;
  register: (userData: RegisterData) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  profileIncomplete: boolean;
}

interface RegisterData {
  email?: string;
  password: string;
  full_name: string;
  phone: string;
  student_name: string;
  date_of_birth: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  console.log('🏗️ AuthProvider: Mounting...');
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Configure API defaults
  console.log('🔗 API Base URL:', API_BASE_URL);

  // Set up authentication header management
  const setAuthToken = (token: string | null) => {
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  };

  // Check if user is authenticated on app start
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      console.log('🔑 Found existing token, verifying...');
      checkAuthStatus();
    } else {
      console.log('❌ No token found');
      setIsLoading(false);
    }
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔍 Verifying token...');
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ME}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setUser(data.user);
      console.log('✅ Token verified, user loaded');
    } catch (error) {
      console.log('❌ Token verification failed:', error);
      localStorage.removeItem('access_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: { email?: string; phone?: string; password: string }) => {
    try {
      console.log('🔐 Attempting login with:', { ...credentials, password: '[REDACTED]' });
      console.log('🌐 API Base URL:', API_BASE_URL);
      console.log('🎯 Login endpoint:', API_ENDPOINTS.LOGIN);
      
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGIN}`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Login failed with status:', response.status, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Login response:', data);
      
      const { access_token, user: userData } = data;

      setAuthToken(access_token);
      setUser(userData);
      
      return userData; // Return user data for immediate use
    } catch (error: any) {
      console.error('❌ Login error:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error stack:', error.stack);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error - cannot connect to server. Please check if the server is running.');
      } else {
        throw new Error(error.message || 'Login failed');
      }
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REGISTER}`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  };

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.VERIFY_EMAIL}`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Email verification failed');
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    register,
    verifyEmail,
    updateUser,
    isLoading,
    isAuthenticated: !!user,
    profileIncomplete: user?.profile_incomplete || false,
  };

  console.log('📦 AuthProvider: Providing value:', { 
    hasUser: !!user, 
    isLoading, 
    isAuthenticated: !!user,
    userId: user?.id
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
