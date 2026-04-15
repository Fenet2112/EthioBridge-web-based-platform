import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = () => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      console.log('[Auth] Initializing authentication...');
      console.log('[Auth] Token exists:', !!storedToken);
      console.log('[Auth] User data exists:', !!storedUser);

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        setIsAuthenticated(true);
        console.log('[Auth] ✓ Session restored:', parsedUser.email, '| Role:', parsedUser.role);
      } else {
        console.log('[Auth] No stored session found');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[Auth] Error initializing auth:', error);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, authToken) => {
    try {
      console.log('[Auth] Logging in user:', userData.email);
      
      // Store in localStorage
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(userData));

      // Update state
      setToken(authToken);
      setUser(userData);
      setIsAuthenticated(true);

      console.log('[Auth] ✓ Login successful');
      return { success: true };
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    console.log('[Auth] Logging out user:', user?.email);
    clearAuth();
  };

  const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    console.log('[Auth] ✓ Auth cleared');
  };

  const updateUser = (userData) => {
    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    console.log('[Auth] User data updated');
  };

  // Helper to get auth headers for API calls
  const getAuthHeaders = () => {
    const currentToken = token || localStorage.getItem('token');
    return currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {};
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    getAuthHeaders,
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
