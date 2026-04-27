const pool = require('./src/config/db');

async function run() {
  console.log('=== Testing admin.js analytics queries ===\n');

  // Test 1: GET /api/admin/analytics
  const tests = [
    {
      name: 'analytics - user growth',
      sql: `SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count FROM users GROUP BY month ORDER BY month DESC LIMIT 12`
    },
    {
      name: 'analytics - total products',
      sql: `SELECT COUNT(*) AS total FROM products p JOIN industries i ON i.id = p.industry_id JOIN users u ON u.id = i.user_id WHERE u.status = 'approved'`
    },
    {
      name: 'analytics - requests by status',
      sql: `SELECT status, COUNT(*) AS count FROM purchase_requests GROUP BY status`
    },
    {
      name: 'analytics - sector distribution',
      sql: `SELECT sector, COUNT(*) AS count FROM industries i JOIN users u ON u.id = i.user_id WHERE u.status = 'approved' GROUP BY sector ORDER BY count DESC LIMIT 8`
    },
    // Test the users/all query that uses login_count
    {
      name: 'users/all - login_count column',
      sql: `SELECT u.id, u.login_count FROM users u LIMIT 1`
    },
    {
      name: 'users/all - last_login_at column',
      sql: `SELECT u.id, u.last_login_at FROM users u LIMIT 1`
    },
    // Test the pending query
    {
      name: 'pending users',
      sql: `SELECT u.id, u.email, u.role, u.status FROM users u WHERE u.status = 'pending' LIMIT 5`
    },
    // Test top-sellers with date filter
    {
      name: 'top-sellers with 7d filter',
      sql: `
        SELECT i.id, i.company_name AS industry_name, i.sector,
          COALESCE(SUM(p.price * pr.quantity), 0) AS value
        FROM industries i
        JOIN users u ON u.id = i.user_id
        LEFT JOIN purchase_requests pr ON pr.industry_id = i.id 
          AND pr.status IN ('approved','completed')
          AND pr.created_at >= NOW() - INTERVAL '7 days'
        LEFT JOIN products p ON p.id = pr.product_id
        WHERE u.status = 'approved'
        GROUP BY i.id, i.company_name, i.sector
        ORDER BY value DESC
        LIMIT 10
      `
    }
  ];

  for (const t of tests) {
    try {
      const r = await pool.query(t.sql);
      console.log(`✅ ${t.name}: OK (${r.rows.length} rows)`);
    } catch (e) {
      console.error(`❌ ${t.name}: FAILED — ${e.message}`);
    }
  }

  process.exit(0);
}

run();
