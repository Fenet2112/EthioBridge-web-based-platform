const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getJwtSecret } = require("../middleware/auth");
const { sendVerificationEmail, sendSignupNotification, sendPasswordResetEmail } = require("../utils/sendEmail");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ── Multer for stakeholder ID documents ──
const idStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/id_documents";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = req.body.user_id || "unknown";
    cb(null, `stakeholder_id_${userId}_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadStakeholderID = multer({
  storage: idStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|pdf/.test(path.extname(file.originalname).toLowerCase());
    cb(null, ok);
  },
});

// ── SIGNUP ──
router.post("/signup", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: "Email, password, and role are required" });
    }

    if (!["industry", "stakeholder"].includes(role)) {
      return res.status(400).json({ message: "Role must be 'industry' or 'stakeholder'" });
    }

    // Check if email already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token (expires in 24h)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newUser = await pool.query(
      `INSERT INTO users (email, password, role, status, email_verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, 'incomplete', FALSE, $4, $5)
       RETURNING id, email, role, status`,
      [email, hashedPassword, role, verificationToken, tokenExpires]
    );

    // Send emails (non-fatal — don't fail signup if email fails)
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailErr) {
      console.error("Verification email failed (non-fatal):", emailErr.message);
    }
    try {
      await sendSignupNotification(email);
    } catch (emailErr) {
      console.error("Signup notification failed (non-fatal):", emailErr.message);
    }

    res.status(201).json({
      message: "Account created. Please check your email to verify your address.",
      user: newUser.rows[0],
      emailSent: true,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── LOGIN ──
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Block banned or suspended users
    if (user.status === 'banned') {
      return res.status(403).json({
        message: "Your account has been banned. Please contact support at support@ethiobridge.et",
        status: 'banned'
      });
    }
    if (user.status === 'suspended') {
      const until = user.suspended_until
        ? ` until ${new Date(user.suspended_until).toLocaleDateString()}`
        : '';
      return res.status(403).json({
        message: `Your account is temporarily suspended${until}. Please contact support.`,
        status: 'suspended'
      });
    }

    // Block unverified email
    if (!user.email_verified) {
      return res.status(403).json({
        message: "Please verify your email address before logging in. Check your inbox for the verification link.",
        status: 'unverified',
        email: user.email,
      });
    }    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, status: user.status },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── SUBMIT INDUSTRY PROFILE ──
router.post("/profile/industry", async (req, res) => {
  try {
    const { user_id, company_name, sector, location, description, phone, website, established_year } = req.body;

    if (!user_id || !company_name || !sector || !location) {
      return res.status(400).json({ message: "user_id, company_name, sector, and location are required" });
    }

    // Check user exists and is industry role
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    if (userResult.rows[0].role !== "industry") {
      return res.status(403).json({ message: "User is not an industry account" });
    }

    // Upsert industry profile
    await pool.query(
      `INSERT INTO industries (user_id, company_name, sector, location, description, phone, website, established_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         sector = EXCLUDED.sector,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         phone = EXCLUDED.phone,
         website = EXCLUDED.website,
         established_year = EXCLUDED.established_year`,
      [user_id, company_name, sector, location, description || null, phone || null, website || null, established_year || null]
    );

    // Update user status to pending
    await pool.query("UPDATE users SET status = 'pending' WHERE id = $1", [user_id]);

    res.json({ message: "Industry profile submitted. Awaiting admin approval." });
  } catch (error) {
    console.error("Industry profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── SUBMIT STAKEHOLDER PROFILE ──
router.post("/profile/stakeholder", uploadStakeholderID.single("id_document"), async (req, res) => {
  try {
    const { user_id, organization_name, organization_type, location, description, phone, contact_person, id_document_type } = req.body;

    console.log('Stakeholder profile submission:', { user_id, organization_name, organization_type, location });

    if (!user_id || !organization_name || !organization_type || !location) {
      return res.status(400).json({ message: "user_id, organization_name, organization_type, and location are required" });
    }

    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    if (userResult.rows[0].role !== "stakeholder") {
      return res.status(403).json({ message: "User is not a stakeholder account" });
    }

    const idDocUrl = req.file ? `/uploads/id_documents/${req.file.filename}` : null;
    const idDocType = id_document_type || null;

    // Upsert stakeholder profile
    await pool.query(
      `INSERT INTO stakeholders (user_id, organization_name, organization_type, location, description, phone, contact_person, id_document_url, id_document_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         organization_name = EXCLUDED.organization_name,
         organization_type = EXCLUDED.organization_type,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         phone = EXCLUDED.phone,
         contact_person = EXCLUDED.contact_person,
         id_document_url = COALESCE(EXCLUDED.id_document_url, stakeholders.id_document_url),
         id_document_type = COALESCE(EXCLUDED.id_document_type, stakeholders.id_document_type)`,
      [user_id, organization_name, organization_type, location, description || null, phone || null, contact_person || null, idDocUrl, idDocType]
    );

    // Update user status to pending
    await pool.query("UPDATE users SET status = 'pending' WHERE id = $1", [user_id]);

    res.json({ message: "Stakeholder profile submitted. Awaiting admin approval." });
  } catch (error) {
    console.error("Stakeholder profile CRASH:", error.message);
    res.status(500).json({
      message: "Server error - see backend logs for details",
      ...(process.env.NODE_ENV !== "production" && { error: error.message, code: error.code }),
    });
  }
});

// ── GET INDUSTRY PROFILE STATUS ──
router.get("/profile/industry/status", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = require("jsonwebtoken").verify(token, getJwtSecret());
    
    if (decoded.role !== "industry") {
      return res.json({ status: decoded.status });
    }

    const userResult = await pool.query("SELECT status FROM users WHERE id = $1", [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.json({ status: "incomplete" });
    }

    const indResult = await pool.query("SELECT * FROM industries WHERE user_id = $1", [decoded.id]);
    
    res.json({
      status: userResult.rows[0].status,
      profile: indResult.rows[0] || null
    });
  } catch (error) {
    console.error("Get profile status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET STAKEHOLDER PROFILE STATUS ──
router.get("/profile/stakeholder/status", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = require("jsonwebtoken").verify(token, getJwtSecret());
    
    if (decoded.role !== "stakeholder") {
      return res.json({ status: decoded.status });
    }

    const userResult = await pool.query("SELECT status FROM users WHERE id = $1", [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.json({ status: "incomplete" });
    }

    const stakeResult = await pool.query("SELECT * FROM stakeholders WHERE user_id = $1", [decoded.id]);
    
    res.json({
      status: userResult.rows[0].status,
      profile: stakeResult.rows[0] || null
    });
  } catch (error) {
    console.error("Get stakeholder profile status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── VERIFY EMAIL (direct link from email — verifies token and redirects to frontend) ──
router.get("/verify-email", async (req, res) => {
  const { token } = req.query;
  const frontendUrl = process.env.APP_URL || "http://localhost:3000";

  if (!token) {
    return res.redirect(`${frontendUrl}/verify-email?status=invalid`);
  }

  try {
    const result = await pool.query(
      "SELECT id, email_verified, verification_token_expires FROM users WHERE verification_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      return res.redirect(`${frontendUrl}/verify-email?status=invalid`);
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.redirect(`${frontendUrl}/verify-email?status=already_verified`);
    }

    if (new Date() > new Date(user.verification_token_expires)) {
      return res.redirect(`${frontendUrl}/verify-email?status=expired`);
    }

    await pool.query(
      "UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = $1",
      [user.id]
    );

    return res.redirect(`${frontendUrl}/verify-email?status=success`);
  } catch (error) {
    console.error("Verify email error:", error);
    return res.redirect(`${frontendUrl}/verify-email?status=invalid`);
  }
});

// ── RESEND VERIFICATION EMAIL ──
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  try {
    const result = await pool.query(
      "SELECT id, email_verified FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({ message: "If that email is registered, a verification link has been sent." });
    }

    const user = result.rows[0];
    if (user.email_verified) {
      return res.json({ message: "This email is already verified. You can log in." });
    }

    const verificationToken = require("crypto").randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      "UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3",
      [verificationToken, tokenExpires, user.id]
    );

    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailErr) {
      console.error("Resend verification email failed:", emailErr.message);
    }

    res.json({ message: "Verification email sent. Please check your inbox." });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── FORGOT PASSWORD ──
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  try {
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

    // Always return success to avoid revealing whether email exists
    if (result.rows.length === 0) {
      return res.json({ message: "If that email is registered, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
      [token, expires, result.rows[0].id]
    );

    try {
      await sendPasswordResetEmail(email, token);
    } catch (emailErr) {
      console.error("Password reset email failed:", emailErr.message);
      return res.status(500).json({ message: "Failed to send reset email. Please try again." });
    }

    res.json({ message: "If that email is registered, a reset link has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── RESET PASSWORD (GET — validate token, redirect to frontend form) ──
router.get("/reset-password", async (req, res) => {
  const { token } = req.query;
  const frontendUrl = process.env.APP_URL || "http://localhost:3000";

  if (!token) return res.redirect(`${frontendUrl}/reset-password?status=invalid`);

  try {
    const result = await pool.query(
      "SELECT id, reset_token_expires FROM users WHERE reset_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      return res.redirect(`${frontendUrl}/reset-password?status=invalid`);
    }

    if (new Date() > new Date(result.rows[0].reset_token_expires)) {
      return res.redirect(`${frontendUrl}/reset-password?status=expired`);
    }

    // Token valid — redirect to frontend with token so user can set new password
    return res.redirect(`${frontendUrl}/reset-password?token=${token}`);
  } catch (error) {
    console.error("Reset password GET error:", error);
    return res.redirect(`${frontendUrl}/reset-password?status=invalid`);
  }
});

// ── RESET PASSWORD (POST — save new password) ──
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: "Token and password are required." });
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });

  try {
    const result = await pool.query(
      "SELECT id, reset_token_expires FROM users WHERE reset_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid or already used reset link.", code: "invalid" });
    }

    if (new Date() > new Date(result.rows[0].reset_token_expires)) {
      return res.status(400).json({ message: "Reset link has expired. Please request a new one.", code: "expired" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [hashedPassword, result.rows[0].id]
    );

    res.json({ message: "Password reset successfully. You can now log in.", code: "success" });
  } catch (error) {
    console.error("Reset password POST error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
