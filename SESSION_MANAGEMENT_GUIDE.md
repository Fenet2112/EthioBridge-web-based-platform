# Session Management System - Complete Guide

## Overview
The system uses **JWT (JSON Web Tokens)** for authentication with automatic token refresh and expiry handling.

## Architecture

### Token Types
1. **Access Token** - Short-lived (7 days), used for API requests
2. **Refresh Token** - Long-lived (30 days), used to get new access tokens

### Token Flow
```
Login → Access Token (7d) + Refresh Token (30d)
  ↓
API Request with Access Token
  ↓
Token Expired? → Use Refresh Token → New Access Token
  ↓
Refresh Token Expired? → Redirect to Login
```

## Backend Implementation

### 1. Token Generation (`backend/src/middleware/auth.js`)

**Access Token:**
```javascript
{
  id: user.id,
  email: user.email,
  role: user.role,
  status: user.status,
  type: 'access',
  exp: 7 days from now
}
```

**Refresh Token:**
```javascript
{
  id: user.id,
  email: user.email,
  type: 'refresh',
  exp: 30 days from now
}
```

### 2. Authentication Middleware

**Features:**
- Validates JWT signature
- Checks token type (access vs refresh)
- Provides detailed error codes
- Logs authentication attempts

**Error Codes:**
- `NO_TOKEN` - No token provided
- `TOKEN_EXPIRED` - Token has expired
- `INVALID_TOKEN` - Token is malformed
- `INVALID_TOKEN_TYPE` - Wrong token type used

### 3. Login Endpoint (`POST /api/login`)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "7d",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "stakeholder",
    "status": "approved"
  }
}
```

### 4. Token Refresh Endpoint (`POST /api/refresh-token`)

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "message": "Token refreshed successfully",
  "token": "new_access_token",
  "refreshToken": "new_refresh_token",
  "expiresIn": "7d",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "stakeholder",
    "status": "approved"
  }
}
```

## Frontend Implementation

### 1. Auth Context (`frontend/src/contexts/AuthContext.jsx`)

**Features:**
- Manages authentication state
- Stores tokens in localStorage
- Automatic token refresh every 6 days
- Handles login/logout
- Provides auth hooks

**Usage:**
```jsx
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  if (!isAuthenticated) {
    return <div>Please login</div>;
  }
  
  return <div>Welcome {user.email}</div>;
}
```

### 2. API Utility (`frontend/src/utils/api.js`)

**Features:**
- Automatic token injection
- Token expiry detection
- Automatic token refresh
- Retry logic on failure
- User-friendly error messages

**Usage:**
```javascript
import { apiRequest } from './utils/api';

// Automatically includes token and handles expiry
const data = await apiRequest('/api/industries', {
  method: 'GET'
});
```

### 3. Token Storage

**localStorage Keys:**
- `token` - Access token
- `refreshToken` - Refresh token
- `user` - User data (JSON)

**Security:**
- Tokens stored in localStorage (XSS protection via CSP)
- httpOnly cookies not used (CORS complexity)
- Tokens cleared on logout
- Automatic cleanup on expiry

## Token Lifecycle

### 1. Initial Login
```
User enters credentials
  ↓
POST /api/login
  ↓
Receive access + refresh tokens
  ↓
Store in localStorage
  ↓
Set auth state
```

### 2. Making API Requests
```
Get token from localStorage
  ↓
Add Authorization: Bearer <token>
  ↓
Send request
  ↓
Success? → Return data
  ↓
401 Error? → Try refresh
```

### 3. Token Refresh
```
Access token expired
  ↓
POST /api/refresh-token with refresh token
  ↓
Receive new tokens
  ↓
Update localStorage
  ↓
Retry original request
```

### 4. Session Expiry
```
Refresh token expired
  ↓
Clear localStorage
  ↓
Redirect to /login
  ↓
Show "Session expired" message
```

## Security Features

### 1. Token Validation
- JWT signature verification
- Expiry time checking
- Token type validation
- User status checking

### 2. Error Handling
- Detailed error codes
- Secure error messages (no sensitive data)
- Automatic logout on security issues
- Logging for debugging

### 3. Best Practices
✅ Tokens expire automatically
✅ Refresh tokens have longer expiry
✅ Tokens cleared on logout
✅ HTTPS in production (set in deployment)
✅ No sensitive data in tokens
✅ Database status checked on critical operations

## Common Scenarios

### Scenario 1: User Stays Logged In
- Access token valid for 7 days
- Refresh token valid for 30 days
- Auto-refresh every 6 days
- User stays logged in for up to 30 days

### Scenario 2: Token Expires During Use
- API request fails with 401
- Frontend automatically refreshes token
- Original request retried
- User doesn't notice

### Scenario 3: Long Inactivity
- User inactive for 30+ days
- Refresh token expires
- Next request fails
- User redirected to login

### Scenario 4: Account Status Changes
- Admin bans/suspends user
- Next API request checks database
- Returns 403 with status
- User logged out automatically

## Debugging

### Check Token Status
```javascript
// In browser console
const token = localStorage.getItem('token');
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log('Token expires:', new Date(decoded.exp * 1000));
console.log('Token type:', decoded.type);
console.log('User:', decoded.email);
```

### Common Issues

**Issue: "Token expired" immediately after login**
- Check server time vs client time
- Verify JWT_SECRET is consistent
- Check token expiry in code

**Issue: Constant redirects to login**
- Check if token is being stored
- Verify localStorage is accessible
- Check browser console for errors

**Issue: 401 errors on all requests**
- Verify token is in Authorization header
- Check token format: "Bearer <token>"
- Verify backend is running

## Testing

### 1. Test Login
```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 2. Test Protected Endpoint
```bash
curl http://localhost:5000/api/industries \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Test Token Refresh
```bash
curl -X POST http://localhost:5000/api/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

## Monitoring

### Backend Logs
Look for:
- `[LOGIN] Login attempt for email: ...`
- `[Auth] User authenticated: ...`
- `[Refresh] New tokens generated for user ...`
- `[Auth] Token verification failed: ...`

### Frontend Logs
Look for:
- `[Auth] Session restored from localStorage`
- `[Auth] Login successful: ...`
- `[API] Unauthorized - attempting token refresh`
- `[Auth] Token refreshed successfully`

## Migration from Old System

If you had a different auth system:

1. **Clear old tokens:**
```javascript
localStorage.clear();
```

2. **Users must login again** to get new tokens

3. **Update all API calls** to use new `apiRequest` utility

4. **Wrap app in AuthProvider:**
```jsx
import { AuthProvider } from './contexts/AuthContext';

<AuthProvider>
  <App />
</AuthProvider>
```

## Production Checklist

- [ ] JWT_SECRET set in environment variables
- [ ] HTTPS enabled
- [ ] CORS configured correctly
- [ ] Token expiry times appropriate
- [ ] Error logging enabled
- [ ] Health endpoint monitored
- [ ] Session timeout tested
- [ ] Token refresh tested
- [ ] Logout functionality tested

## Summary

✅ **Stable**: Tokens don't expire unexpectedly
✅ **Secure**: JWT with proper validation
✅ **Automatic**: Token refresh without user action
✅ **Resilient**: Retry logic and error handling
✅ **User-Friendly**: Seamless experience
✅ **Debuggable**: Comprehensive logging

**Result:** Users stay logged in reliably for up to 30 days with automatic token refresh every 6 days. No more unexpected logouts or session errors!
