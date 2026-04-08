const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

// ── Plan definitions (single source of truth) ──
const PLANS = {
  free: {
    stakeholder: { requests_per_month: 1, messages_per_month: 3, full_details: false },
    industry:    { max_products: 5, analytics: "basic", featured: false, verified_badge: false },
  },
  premium: {
    stakeholder: { requests_per_month: Infinity, messages_per_month: Infinity, full_details: true },
    industry:    { max_products: Infinity, analytics: "full", featured: true, verified_badge: true },
  },
};

// Helper: resolve active subscription type for a user row
function resolveSubType(user) {
  const now = new Date();
  const isActive =
    user.is_subscribed &&
    (!user.subscription_expires_at || new Date(user.subscription_expires_at) > now);
  return isActive ? "premium" : "free";
}

// Helper: reset monthly message counter if new month
async function maybeResetMessages(userId, user) {
  const resetAt = user.messages_month_reset_at ? new Date(user.messages_month_reset_at) : new Date(0);
  const now = new Date();
  if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
    await pool.query(
      "UPDATE users SET messages_used_this_month = 0, messages_month_reset_at = NOW() WHERE id = $1",
      [userId]
    );
    return 0;
  }
  return user.messages_used_this_month || 0;
}

// ── GET /api/subscription/status ──
router.get("/subscription/status", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT free_requests_used, is_subscribed, subscription_expires_at,
              messages_used_this_month, messages_month_reset_at, subscription_type
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = result.rows[0];
    const subType = resolveSubType(user);
    const role = req.user.role;
    const limits = PLANS[subType][role] || PLANS.free[role];

    const messagesUsed = await maybeResetMessages(req.user.id, user);
    const freeUsed = user.free_requests_used || 0;

    const canRequest = subType === "premium" || freeUsed < PLANS.free.stakeholder.requests_per_month;
    const canMessage = subType === "premium" || messagesUsed < PLANS.free[role]?.messages_per_month;

    res.json({
      subscription_type: subType,
      is_subscribed: subType === "premium",
      subscription_expires_at: user.subscription_expires_at,
      role,
      limits,
      // Stakeholder-specific
      free_requests_used: freeUsed,
      free_requests_limit: PLANS.free.stakeholder.requests_per_month,
      can_request: canRequest,
      messages_used_this_month: messagesUsed,
      messages_limit: limits.messages_per_month === Infinity ? null : limits.messages_per_month,
      can_message: canMessage,
      full_details: subType === "premium",
      // Industry-specific
      max_products: limits.max_products === Infinity ? null : limits.max_products,
      analytics_level: limits.analytics,
      featured: limits.featured,
    });
  } catch (err) {
    console.error("Subscription status error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/subscription/activate ──
router.post("/subscription/activate", authenticateToken, async (req, res) => {
  const { plan = "monthly", payment_method = "telebirr" } = req.body;
  const amount = plan === "yearly" ? 1.0 : 1.0;
  const expiresAt = new Date();
  if (plan === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  else expiresAt.setMonth(expiresAt.getMonth() + 1);

  try {
    await pool.query(
      `UPDATE users
       SET is_subscribed = true, subscription_expires_at = $1, subscription_type = 'premium'
       WHERE id = $2`,
      [expiresAt, req.user.id]
    );

    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, amount, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, plan, amount, expiresAt]
    );

    res.json({
      message: "Subscription activated!",
      subscription_type: "premium",
      expires_at: expiresAt,
      plan,
      payment_method,
    });
  } catch (err) {
    console.error("Subscription activate error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/subscription/plans ── (public, no auth needed)
router.get("/subscription/plans", (req, res) => {
  res.json({
    stakeholder: {
      free: {
        price_monthly: 0,
        features: [
          "Browse all industries",
          "View basic info (name, category, price)",
          "1 purchase request per month",
          "3 messages per month",
          "Basic search & filter",
        ],
        limits: { requests: 1, messages: 3, full_details: false },
      },
      premium: {
        price_monthly: 1,
        price_yearly: 1,
        features: [
          "Full business details (financials, ROI, contacts)",
          "Unlimited purchase requests",
          "Unlimited direct messaging",
          "Advanced filtering (verified, high ROI)",
          "Personalized recommendations",
          "Market insights & trends",
          "Priority support",
        ],
        limits: { requests: null, messages: null, full_details: true },
      },
    },
    industry: {
      free: {
        price_monthly: 0,
        features: [
          "Basic company profile",
          "Up to 5 product listings",
          "Standard search visibility",
          "View count analytics only",
        ],
        limits: { max_products: 5, analytics: "basic", featured: false },
      },
      premium: {
        price_monthly: 1,
        price_yearly: 1,
        features: [
          "Unlimited product listings",
          "Featured listing (top of search)",
          "Full analytics (views, clicks, interested stakeholders)",
          "Direct messages from stakeholders",
          "Verified badge",
          "Priority in recommendation system",
          "Priority support",
        ],
        limits: { max_products: null, analytics: "full", featured: true },
      },
    },
  });
});

// ── GET /api/subscription/analytics (industry only) ──
router.get("/subscription/analytics", authenticateToken, async (req, res) => {
  if (req.user.role !== "industry") {
    return res.status(403).json({ message: "Industry accounts only" });
  }

  try {
    const industryRes = await pool.query(
      "SELECT id FROM industries WHERE user_id = $1",
      [req.user.id]
    );
    if (industryRes.rows.length === 0) {
      return res.status(404).json({ message: "Industry profile not found" });
    }
    const industryId = industryRes.rows[0].id;

    // Check subscription
    const userRes = await pool.query(
      "SELECT is_subscribed, subscription_expires_at FROM users WHERE id = $1",
      [req.user.id]
    );
    const subType = resolveSubType(userRes.rows[0]);

    // Basic analytics (available to all)
    const viewsRes = await pool.query(
      `SELECT COUNT(*) AS total_views FROM industry_analytics
       WHERE industry_id = $1 AND event_type = 'profile_view'`,
      [industryId]
    );

    const basic = {
      total_profile_views: parseInt(viewsRes.rows[0].total_views),
    };

    if (subType !== "premium") {
      return res.json({ analytics_level: "basic", ...basic });
    }

    // Full analytics (premium only)
    const clicksRes = await pool.query(
      `SELECT COUNT(*) AS total_clicks FROM industry_analytics
       WHERE industry_id = $1 AND event_type = 'product_click'`,
      [industryId]
    );
    const requestsRes = await pool.query(
      `SELECT COUNT(*) AS total_requests FROM purchase_requests
       WHERE industry_id = $1`,
      [industryId]
    );
    const recentRes = await pool.query(
      `SELECT event_type, COUNT(*) AS count,
              DATE_TRUNC('day', created_at) AS day
       FROM industry_analytics
       WHERE industry_id = $1 AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY event_type, day
       ORDER BY day DESC`,
      [industryId]
    );

    res.json({
      analytics_level: "full",
      ...basic,
      total_product_clicks: parseInt(clicksRes.rows[0].total_clicks),
      total_purchase_requests: parseInt(requestsRes.rows[0].total_requests),
      recent_activity: recentRes.rows,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/subscription/track-view (record profile view) ──
router.post("/subscription/track-view", authenticateToken, async (req, res) => {
  const { industry_id, event_type = "profile_view" } = req.body;
  if (!industry_id) return res.status(400).json({ message: "industry_id required" });

  try {
    await pool.query(
      `INSERT INTO industry_analytics (industry_id, event_type, visitor_user_id)
       VALUES ($1, $2, $3)`,
      [industry_id, event_type, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    // Non-critical — don't fail the request
    res.json({ ok: false });
  }
});

module.exports = router;
module.exports.PLANS = PLANS;
module.exports.resolveSubType = resolveSubType;
