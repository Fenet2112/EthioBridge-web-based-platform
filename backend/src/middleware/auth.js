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
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, status }
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
}

/**
 * Middleware factory – restricts access to specified roles.
 * Usage: requireRole('industry') or requireRole('stakeholder', 'industry')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}.`,
      });
    }
    next();
  };
}

/**
 * Middleware – only allows approved users through.
 * Must be used after authenticateToken.
 */
function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated." });
  }
  if (req.user.status !== "approved") {
    return res.status(403).json({
      message: "Your account must be approved by admin before accessing this feature.",
    });
  }
  next();
}

module.exports = { authenticateToken, requireRole, requireApproved, getJwtSecret };
