// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Create the context
export const AuthContext = createContext();

// Create a provider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define logout function early to avoid reference issues
  const logout = async () => {
    try {
      setLoading(true);
      
      
      // Call logout endpoint
      await axios.post('http://localhost:5000/auth/logout', {}, {
        withCredentials: true // Important for cookies
      });
      
      
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Always clear local state and storage, even if the API call fails
      setCurrentUser(null);
      setAccessToken(null);
      
      // Remove from sessionStorage
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('user');
      
      // Clear axios default header
      delete axios.defaults.headers.common['Authorization'];
      
      setLoading(false);
      
      // Force a page refresh to clear any lingering state
      window.location.href = '/';
    }
  };

  // Initialize the auth by checking for existing tokens/user
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = sessionStorage.getItem('accessToken');
        const storedUser = sessionStorage.getItem('user');
        
        if (storedToken && storedUser) {
          // Configure axios to use the token
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          setAccessToken(storedToken);
          setCurrentUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Clear any corrupted data
        setCurrentUser(null);
        setAccessToken(null);
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle token refresh
  const refreshToken = useCallback(async () => {
    try {
      const response = await axios.post('http://localhost:5000/auth/refresh', {}, {
        withCredentials: true // Important for cookies
      });
      
      
      const { accessToken } = response.data;
      
      // Update token in state and headers
      setAccessToken(accessToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      // Update in sessionStorage
      sessionStorage.setItem('accessToken', accessToken);
      
      return accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Instead of calling logout directly, do cleanup operations
      setCurrentUser(null);
      setAccessToken(null);
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/'; // Force redirect to login
      return null;
    }
  }, []);

  // Set up axios interceptor for automatic token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Check if error is due to an expired token
        if (
          error.response &&
          error.response.status === 403 &&
          error.response.data.code === 'AUTH_TOKEN_INVALID'
        ) {
          try {
            // Try to refresh the token
            const newToken = await refreshToken();
            
            if (newToken) {
              // Retry the original request with the new token
              const originalRequest = error.config;
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );

    // Clean up the interceptor when the component unmounts
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [refreshToken]);

  // Login function with enhanced logging
  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      
      
      
      const response = await axios.post('http://localhost:5000/auth/login', {
        email,
        password,
      }, {
        withCredentials: true 
      });
      
      
      
      // The backend sends { status, message, accessToken, user }
      const { accessToken, user } = response.data;
      
      
      
      // Set the token in axios headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      // Store in state
      setAccessToken(accessToken);
      setCurrentUser(user);
      
      // Store in sessionStorage 
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('user', JSON.stringify(user));
      
      return user;
    } catch (error) {
      console.error("Login error:", error);
      console.error("Error response:", error.response?.data);
      setError(error.response?.data?.message || 'An error occurred during login');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Signup function
  const signup = async (name, email, password) => {
    try {
      setError(null);
      setLoading(true);
      
      
      
      const response = await axios.post('http://localhost:5000/auth/signup', {
        name,
        email,
        password,
      }, {
        withCredentials: true 
      });
      
      
      
      const { accessToken, user } = response.data;
      
      // Set the token in axios headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      // Store in state
      setAccessToken(accessToken);
      setCurrentUser(user);
      
      // Store in sessionStorage (more secure than localStorage)
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('user', JSON.stringify(user));
      
      return user;
    } catch (error) {
      console.error("Signup error:", error);
      console.error("Error response:", error.response?.data);
      setError(error.response?.data?.message || 'An error occurred during signup');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get current user data
  const getCurrentUser = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/auth/user/profile', {
        withCredentials: true
      });
      setCurrentUser(response.data.user);
      return response.data.user;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Create a value object with all the auth functionality
  const value = {
    currentUser,
    accessToken,
    loading,
    error,
    login,
    signup,
    logout,
    refreshToken,
    getCurrentUser,
    isAuthenticated: !!accessToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};