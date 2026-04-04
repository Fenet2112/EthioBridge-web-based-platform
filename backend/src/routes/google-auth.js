const express = require("express");
const router  = express.Router();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require("../config/db");
const jwt  = require("jsonwebtoken");
const { getJwtSecret } = require("../middleware/auth");

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "YOUR_GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET";
const FRONTEND_URL         = process.env.APP_URL               || "http://localhost:3000";
const BACKEND_URL          = process.env.BACKEND_URL           || "http://localhost:5000";

// Only register strategy if real credentials are provided
if (GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID") {
  passport.use(new GoogleStrategy(
    {
      clientID:     GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL:  `${BACKEND_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("No email from Google"), null);

        // Find or create user
        let result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        let user;

        if (result.rows.length === 0) {
          // New user — needs role selection, create with incomplete status
          const newUser = await pool.query(
            `INSERT INTO users (email, password, role, status)
             VALUES ($1, $2, 'stakeholder', 'incomplete') RETURNING *`,
            [email, "google-oauth-no-password"]
          );
          user = newUser.rows[0];
        } else {
          user = result.rows[0];
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const r = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, r.rows[0]);
  } catch (e) { done(e); }
});

// ── Initiate Google OAuth ──
router.get("/auth/google",
  (req, res, next) => {
    // Store role from query param in session/state
    const role = req.query.role || "stakeholder";
    req.session = req.session || {};
    req.session.googleRole = role;
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// ── Google OAuth callback ──
router.get("/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${FRONTEND_URL}/signup?error=google_failed` }),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.redirect(`${FRONTEND_URL}/signup?error=no_user`);

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, status: user.status },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

      // Redirect to frontend with token — frontend picks it up from URL
      const redirectPath = user.status === "incomplete"
        ? `/profile/${user.role}`
        : user.role === "industry" ? "/industry" : "/stakeholders";

      res.redirect(
        `${FRONTEND_URL}/auth/google/success?token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, role: user.role, status: user.status }))}&redirect=${redirectPath}`
      );
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect(`${FRONTEND_URL}/signup?error=server_error`);
    }
  }
);

// ── Check if Google OAuth is configured ──
router.get("/auth/google/status", (req, res) => {
  res.json({ configured: GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID" });
});

module.exports = { router, passport };
