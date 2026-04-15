import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Initialize auth state from localStorage
  useEffect(() => {
    initializeAuth();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (token && refreshToken) {
      // Refresh token every 6 days (before 7-day expiry)
      const refreshInterval = setInterval(() => {
        refreshAccessToken();
      }, 6 * 24 * 60 * 60 * 1000); // 6 days

      return () => clearInterval(refreshInterval);
    }
  }, [token, refreshToken]);

  const initializeAuth = () => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        console.log('[Auth] Session restored from localStorage');
      } else {
        console.log('[Auth] No stored session found');
      }
    } catch (error) {
      console.error('[Auth] Error initializing auth:', error);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store tokens and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      setToken(data.token);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      setIsAuthenticated(true);

      console.log('[Auth] Login successful:', data.user.email);

      return { success: true, user: data.user };
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    console.log('[Auth] Logging out');
    clearAuth();
    navigate('/login');
  };

  const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) {
      console.log('[Auth] No refresh token available');
      return false;
    }

    try {
      console.log('[Auth] Refreshing access token...');
      
      const response = await fetch(`${API_BASE_URL}/api/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If refresh token is expired or invalid, logout
        if (data.code === 'REFRESH_TOKEN_EXPIRED' || data.code === 'INVALID_REFRESH_TOKEN') {
          console.log('[Auth] Refresh token expired, logging out');
          logout();
          return false;
        }
        throw new Error(data.message || 'Token refresh failed');
      }

      // Update tokens
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      setToken(data.token);
      setRefreshToken(data.refreshToken);
      setUser(data.user);

      console.log('[Auth] Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[Auth] Token refresh error:', error);
      logout();
      return false;
    }
  };

  const updateUser = (userData) => {
    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const handleAuthError = (error) => {
    // Handle 401 Unauthorized - token expired
    if (error.code === 'TOKEN_EXPIRED' || error.code === 'NO_TOKEN' || error.code === 'INVALID_TOKEN') {
      console.log('[Auth] Authentication error, attempting token refresh');
      refreshAccessToken();
    }
  };

  const value = {
    user,
    token,
    refreshToken,
    loading,
    isAuthenticated,
    login,
    logout,
    refreshAccessToken,
    updateUser,
    handleAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
