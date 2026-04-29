const jwt = require("jsonwebtoken");

// Lazy getter so a missing JWT_SECRET throws at request time, not at startup
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Please configure it in backend/.env');
  }
  return secret;
};

// Module-level fallback; routes use JWT_SECRET directly
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = '30d';

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

// Verifies JWT and attaches decoded user to req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ 
      message: "Access denied. No token provided.",
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(403).json({ 
        message: "Invalid token type.",
        code: 'INVALID_TOKEN_TYPE'
      });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
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
 * Restricts a route to specific roles.
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
 * Fetches fresh status from DB rather than trusting the JWT claim,
 * so suspended/banned accounts are blocked immediately without waiting for token expiry.
 */
async function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      message: "Not authenticated.",
      code: 'NOT_AUTHENTICATED'
    });
  }
  
  try {
    const pool = require("../config/db");
    const result = await pool.query("SELECT status FROM users WHERE id = $1", [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: "User not found.",
        code: 'USER_NOT_FOUND'
      });
    }
    
    const currentStatus = result.rows[0].status;
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
