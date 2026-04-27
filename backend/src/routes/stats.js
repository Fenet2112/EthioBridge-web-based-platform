/**
 * Public Stats Route
 * GET /api/stats/summary  – returns live platform counts for the landing page
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Simple in-memory cache: refresh every 5 minutes
let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

router.get('/summary', async (req, res) => {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_TTL_MS) {
      return res.json(cache);
    }

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM industries i JOIN users u ON u.id = i.user_id WHERE u.status = 'approved')
          AS industry_count,
        (SELECT COUNT(*) FROM users WHERE status = 'approved')
          AS approved_users,
        (SELECT COUNT(*) FROM purchase_requests WHERE status IN ('approved','pending'))
          AS total_requests,
        (SELECT COUNT(DISTINCT location) FROM industries i JOIN users u ON u.id = i.user_id WHERE u.status = 'approved' AND location IS NOT NULL AND location <> '')
          AS regions_covered,
        (SELECT COUNT(*) FROM products p JOIN industries i ON i.id = p.industry_id JOIN users u ON u.id = i.user_id WHERE u.status = 'approved' AND p.is_available = true)
          AS product_count
    `);

    const row = result.rows[0];
    cache = {
      industryCount:  parseInt(row.industry_count,  10),
      approvedUsers:  parseInt(row.approved_users,  10),
      totalRequests:  parseInt(row.total_requests,  10),
      regionsCovered: parseInt(row.regions_covered, 10),
      productCount:   parseInt(row.product_count,   10),
    };
    cacheTime = now;

    res.json(cache);
  } catch (err) {
    console.error('[Stats] summary error:', err.message);
    // Return safe fallback so the page still renders
    res.status(500).json({
      industryCount: 0,
      approvedUsers: 0,
      totalRequests: 0,
      regionsCovered: 0,
      productCount: 0,
    });
  }
});

module.exports = router;
