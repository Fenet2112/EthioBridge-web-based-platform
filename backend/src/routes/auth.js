const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getJwtSecret, generateAccessToken, generateRefreshToken } = require("../middleware/auth");
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
       VALUES ($1, $2, $3, $4, FALSE, $5, $6)
       RETURNING id, email, role, status`,
      [email, hashedPassword, role,
       role === 'stakeholder' ? 'pending' : 'incomplete',  // stakeholders start as pending, await admin approval
       verificationToken, tokenExpires]
    );

    // Send emails asynchronously (don't block response)
    // Fire and forget - emails will be sent in background
    console.log(`[SIGNUP] Sending verification email to ${email} with token ${verificationToken.substring(0, 10)}...`);
    sendVerificationEmail(email, verificationToken)
      .then(() => console.log(`[SIGNUP] Verification email sent successfully to ${email}`))
      .catch(err => {
        console.error(`[SIGNUP] Verification email FAILED for ${email}:`, err.message);
        console.error('Email error details:', err);
      });
    
    sendSignupNotification(email)
      .then(() => console.log(`[SIGNUP] Signup notification sent successfully to ${email}`))
      .catch(err => {
        console.error(`[SIGNUP] Signup notification FAILED for ${email}:`, err.message);
      });

    // Respond immediately without waiting for emails
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

    console.log(`[LOGIN] Login attempt for email: ${email}`);

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      console.log(`[LOGIN] User not found: ${email}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = userResult.rows[0];
    console.log(`[LOGIN] User found: ${email}, email_verified: ${user.email_verified}, status: ${user.status}`);

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log(`[LOGIN] Invalid password for: ${email}`);
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

    // TEMPORARY: Auto-verify email if not verified (until SendGrid is configured)
    // TODO: Remove this once EMAIL_USER/EMAIL_PASS are correctly configured
    if (!user.email_verified) {
      console.log(`[LOGIN] Auto-verifying email for ${email} — remove this once SMTP is working`);
      await pool.query("UPDATE users SET email_verified = TRUE WHERE id = $1", [user.id]);
      user.email_verified = true;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    console.log(`[LOGIN] Tokens generated for ${email}`);

    res.json({
      message: "Login successful",
      token: accessToken,
      refreshToken: refreshToken,
      expiresIn: '7d',
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
    const { user_id, company_name, sector, business_role, location, description, phone, website, established_year, latitude, longitude } = req.body;

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
      `INSERT INTO industries (user_id, company_name, sector, business_role, location, description, phone, website, established_year, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         sector = EXCLUDED.sector,
         business_role = EXCLUDED.business_role,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         phone = EXCLUDED.phone,
         website = EXCLUDED.website,
         established_year = EXCLUDED.established_year,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude`,
      [user_id, company_name, sector, business_role || null, location, description || null, phone || null, website || null, established_year || null, latitude || null, longitude || null]
    );

    // Only set status to pending if user is currently incomplete
    // Don't reset approved users back to pending when they edit their profile
    const currentStatus = userResult.rows[0].status;
    if (currentStatus === 'incomplete') {
      // Run through the approval workflow
      const { processIndustryApproval } = require('../services/approvalWorkflow');
      await pool.query("UPDATE users SET status = 'pending' WHERE id = $1", [user_id]);
      const { newStatus, reason } = await processIndustryApproval(parseInt(user_id));
      console.log(`[Auth] Industry ${user_id} workflow result: ${newStatus} — ${reason}`);
      const finalStatus = newStatus || 'pending';
      const msg = finalStatus === 'approved'
        ? 'Industry profile approved automatically.'
        : finalStatus === 'rejected'
        ? `Industry profile rejected: ${reason}`
        : 'Industry profile submitted. Awaiting admin approval.';
      return res.json({ message: msg, status: finalStatus, reason });
    }

    res.json({ 
      message: "Industry profile updated successfully."
    });
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

    // Profile completion just saves data — status is managed by admin approval
    const currentStatus = userResult.rows[0].status;

    res.json({ 
      message: "Stakeholder profile updated successfully.",
      status: currentStatus
    });
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

// ── REFRESH TOKEN (get updated user status) ──
router.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        message: "Refresh token required",
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, getJwtSecret());
    } catch (err) {
      console.log('[Refresh] Token verification failed:', err.message);
      
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: "Refresh token expired. Please login again.",
          code: 'REFRESH_TOKEN_EXPIRED'
        });
      }
      
      return res.status(403).json({ 
        message: "Invalid refresh token",
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    // Check if it's a refresh token
    if (decoded.type !== 'refresh') {
      return res.status(403).json({ 
        message: "Invalid token type",
        code: 'INVALID_TOKEN_TYPE'
      });
    }
    
    // Get fresh user data from database
    const result = await pool.query(
      "SELECT id, email, role, status FROM users WHERE id = $1",
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: "User not found",
        code: 'USER_NOT_FOUND'
      });
    }
    
    const user = result.rows[0];
    
    // Check if user is banned or suspended
    if (user.status === 'banned' || user.status === 'suspended') {
      return res.status(403).json({
        message: "Account is no longer active",
        code: 'ACCOUNT_INACTIVE',
        status: user.status
      });
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    
    console.log(`[Refresh] New tokens generated for user ${user.email}`);
    
    res.json({
      message: "Token refreshed successfully",
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: '7d',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ 
      message: "Server error",
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;
