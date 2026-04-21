/**
 * Tests the actual queries used in admin.js routes
 */
const pool = require('./src/config/db');

async function run() {
  console.log('=== Testing admin.js route queries ===\n');

  const tests = [
    {
      name: 'GET /admin/users/all (no filters)',
      sql: `
        SELECT u.id, u.email, u.role, u.status, u.email_verified, u.created_at,
          COALESCE(i.company_name, s.organization_name) AS display_name,
          i.sector, s.organization_type,
          COUNT(DISTINCT p.id) AS product_count,
          COUNT(DISTINCT pr.id) AS request_count
        FROM users u
        LEFT JOIN industries i ON i.user_id = u.id
        LEFT JOIN stakeholders s ON s.user_id = u.id
        LEFT JOIN products p ON p.industry_id = i.id
        LEFT JOIN purchase_requests pr ON pr.stakeholder_id = s.id
        GROUP BY u.id, u.email, u.role, u.status, u.email_verified, u.created_at,
          i.company_name, s.organization_name, i.sector, s.organization_type
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `,
      params: [20, 0]
    },
    {
      name: 'GET /admin/pending (no filters)',
      sql: `
        SELECT u.id, u.email, u.role, u.status, u.created_at,
          i.company_name, i.sector, i.location AS industry_location,
          s.organization_name, s.organization_type, s.location AS stakeholder_location
        FROM users u
        LEFT JOIN industries i ON i.user_id = u.id
        LEFT JOIN stakeholders s ON s.user_id = u.id
        WHERE u.status = 'pending'
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `,
      params: [20, 0]
    },
    {
      name: 'GET /admin/users/:id/details',
      sql: `
        SELECT u.id, u.email, u.role, u.status, u.email_verified, u.created_at,
          u.ban_reason, u.suspended_until,
          i.company_name, i.sector, i.location AS industry_location,
          s.organization_name, s.organization_type, s.location AS stakeholder_location
        FROM users u
        LEFT JOIN industries i ON i.user_id = u.id
        LEFT JOIN stakeholders s ON s.user_id = u.id
        WHERE u.id = $1
      `,
      params: [1]
    },
    {
      name: 'GET /admin/analytics',
      sql: `SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count FROM users GROUP BY month ORDER BY month DESC LIMIT 12`
    },
    {
      name: 'GET /admin/analytics/top-sellers',
      sql: `
        SELECT i.id, i.company_name AS industry_name, i.sector,
          COALESCE(SUM(p.price * pr.quantity), 0) AS value,
          COUNT(pr.id) AS total_transactions,
          COALESCE(SUM(pr.quantity), 0) AS total_quantity,
          COALESCE(SUM(p.price * pr.quantity), 0) AS total_revenue
        FROM industries i
        JOIN users u ON u.id = i.user_id
        LEFT JOIN purchase_requests pr ON pr.industry_id = i.id AND pr.status IN ('approved','completed')
        LEFT JOIN products p ON p.id = pr.product_id
        WHERE u.status = 'approved'
        GROUP BY i.id, i.company_name, i.sector
        ORDER BY value DESC
        LIMIT $1
      `,
      params: [10]
    }
  ];

  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      const r = await pool.query(t.sql, t.params || []);
      console.log(`✅ ${t.name}: ${r.rows.length} rows`);
      passed++;
    } catch (e) {
      console.error(`❌ ${t.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('✅ All admin queries are working correctly!');
  process.exit(failed > 0 ? 1 : 0);
}

run();
