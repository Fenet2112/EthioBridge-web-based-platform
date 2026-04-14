// API utility with retry logic and better error handling

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Enhanced fetch with retry logic and better error handling
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, retries = 3, retryDelay = 1000) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`[API] ${options.method || 'GET'} ${url} (attempt ${i + 1}/${retries + 1})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);
      
      // Log response
      console.log(`[API] ${options.method || 'GET'} ${url} - ${response.status}`);
      
      return response;
    } catch (error) {
      console.error(`[API] Error on attempt ${i + 1}:`, error.message);
      
      // Don't retry on last attempt
      if (i === retries) {
        throw new Error(getErrorMessage(error));
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
    }
  }
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error) {
  if (error.name === 'AbortError') {
    return 'Request timeout. Please check your internet connection and try again.';
  }
  
  if (error.message === 'Failed to fetch') {
    return 'Unable to connect to server. Please check your internet connection.';
  }
  
  if (error.message.includes('NetworkError')) {
    return 'Network error. Please check your internet connection.';
  }
  
  return error.message || 'An unexpected error occurred';
}

/**
 * API request wrapper with automatic token handling
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    ...options.headers,
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  try {
    const response = await fetchWithRetry(endpoint, {
      ...options,
      headers,
    });
    
    // Handle 401 Unauthorized - token expired
    if (response.status === 401) {
      console.warn('[API] Unauthorized - clearing token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    
    // Parse JSON response
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('[API] Request failed:', error);
    throw error;
  }
}

/**
 * Check if backend is healthy
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      return { healthy: false, status: response.status };
    }
    
    const data = await response.json();
    return { healthy: data.status === 'healthy', ...data };
  } catch (error) {
    console.error('[Health Check] Failed:', error);
    return { healthy: false, error: error.message };
  }
}

export default {
  fetchWithRetry,
  apiRequest,
  checkBackendHealth,
  API_BASE_URL,
};
