const jwt = require("jsonwebtoken");

// JWT secret must be configured via environment variable
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Please configure it in backend/.env');
  }
  return secret;
};

// Don't call getJwtSecret at module load - call it when needed
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '7d'; // 7 days
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

/**
 * Generate access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      status: user.status,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verifies JWT token from Authorization header.
 * Attaches decoded user { id, email, role, status } to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    console.log('[Auth] No token provided');
    return res.status(401).json({ 
      message: "Access denied. No token provided.",
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if it's an access token
    if (decoded.type !== 'access') {
      console.log('[Auth] Invalid token type:', decoded.type);
      return res.status(403).json({ 
        message: "Invalid token type.",
        code: 'INVALID_TOKEN_TYPE'
      });
    }
    
    req.user = decoded; // { id, email, role, status }
    console.log(`[Auth] User authenticated: ${decoded.email} (${decoded.role})`);
    next();
  } catch (err) {
    console.log('[Auth] Token verification failed:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: "Token expired. Please login again.",
        code: 'TOKEN_EXPIRED',
        expiredAt: err.expiredAt
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        message: "Invalid token.",
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(403).json({ 
      message: "Token verification failed.",
      code: 'TOKEN_VERIFICATION_FAILED'
    });
  }
}

/**
 * Middleware factory – restricts access to specified roles.
 * Usage: requireRole('industry') or requireRole('stakeholder', 'industry')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: "Not authenticated.",
        code: 'NOT_AUTHENTICATED'
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}.`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }
    next();
  };
}

/**
 * Middleware – only allows approved users through.
 * Must be used after authenticateToken.
 * Fetches fresh status from database instead of relying on JWT token.
 */
async function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      message: "Not authenticated.",
      code: 'NOT_AUTHENTICATED'
    });
  }
  
  try {
    // Fetch fresh status from database instead of using JWT token status
    const pool = require("../config/db");
    const result = await pool.query("SELECT status FROM users WHERE id = $1", [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: "User not found.",
        code: 'USER_NOT_FOUND'
      });
    }
    
    const currentStatus = result.rows[0].status;
    
    // Update req.user with fresh status from database
    req.user.status = currentStatus;
    
    if (currentStatus !== "approved") {
      return res.status(403).json({
        message: "Your account must be approved by admin before accessing this feature.",
        code: 'ACCOUNT_NOT_APPROVED',
        current_status: currentStatus,
        required_status: "approved",
        action_required: currentStatus === "pending" 
          ? "Please wait for admin approval. You will be notified via email once approved."
          : "Please complete your profile and submit for approval."
      });
    }
    
    next();
  } catch (error) {
    console.error("requireApproved middleware error:", error);
    return res.status(500).json({ 
      message: "Server error checking user status.",
      code: 'SERVER_ERROR'
    });
  }
}

module.exports = { 
  authenticateToken, 
  requireRole, 
  requireApproved, 
  getJwtSecret,
  generateAccessToken,
  generateRefreshToken,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY
};
