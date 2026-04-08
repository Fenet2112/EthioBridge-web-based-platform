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
 * Fetches fresh status from database instead of relying on JWT token.
 */
async function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated." });
  }
  
  try {
    // Fetch fresh status from database instead of using JWT token status
    const pool = require("../config/db");
    const result = await pool.query("SELECT status FROM users WHERE id = $1", [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    
    const currentStatus = result.rows[0].status;
    
    // Update req.user with fresh status from database
    req.user.status = currentStatus;
    
    if (currentStatus !== "approved") {
      return res.status(403).json({
        message: "Your account must be approved by admin before accessing this feature.",
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
    return res.status(500).json({ message: "Server error checking user status." });
  }
}

module.exports = { authenticateToken, requireRole, requireApproved, getJwtSecret };
