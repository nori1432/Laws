import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

interface User {
  id: number;
  email?: string;
  full_name: string;
  phone: string;
  role: 'client' | 'admin';
  email_verified: boolean;
  mobile_username?: string;
  mobile_app_enabled: boolean;
  students?: Array<{
    id: number;
    name: string;
    date_of_birth?: string;
    mobile_username?: string;
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
  login: (credentials: { email?: string; phone?: string; password: string }) => Promise<void>;
  logout: () => void;
  register: (userData: RegisterData) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Configure axios defaults
  axios.defaults.baseURL = API_BASE_URL;

  // Set up axios interceptor for JWT
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Check if user is authenticated on app start
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.get(API_ENDPOINTS.ME);
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: { email?: string; phone?: string; password: string }) => {
    try {
      const response = await axios.post(API_ENDPOINTS.LOGIN, credentials);
      const { access_token, user: userData } = response.data;

      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const response = await axios.post(API_ENDPOINTS.REGISTER, userData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const verifyEmail = async (token: string) => {
    try {
      const response = await axios.post(API_ENDPOINTS.VERIFY_EMAIL, { token });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Email verification failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    register,
    verifyEmail,
    isLoading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
