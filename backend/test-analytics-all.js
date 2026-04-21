const pool = require('./src/config/db');

async function run() {
  console.log('=== Testing all analytics queries ===\n');

  const tests = [
    {
      name: 'user growth',
      sql: `SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count FROM users GROUP BY month ORDER BY month DESC LIMIT 12`
    },
    {
      name: 'total products',
      sql: `SELECT COUNT(*) AS total FROM products p JOIN industries i ON i.id = p.industry_id JOIN users u ON u.id = i.user_id WHERE u.status = 'approved'`
    },
    {
      name: 'requests by status',
      sql: `SELECT status, COUNT(*) AS count FROM purchase_requests GROUP BY status`
    },
    {
      name: 'sector distribution',
      sql: `SELECT sector, COUNT(*) AS count FROM industries i JOIN users u ON u.id = i.user_id WHERE u.status = 'approved' GROUP BY sector ORDER BY count DESC LIMIT 8`
    },
    {
      name: 'top sellers',
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
        LIMIT 10
      `
    }
  ];

  for (const t of tests) {
    try {
      const r = await pool.query(t.sql);
      console.log(`✅ ${t.name}: ${r.rows.length} rows`);
    } catch (e) {
      console.error(`❌ ${t.name}: ${e.message}`);
    }
  }

  // Also check what columns users table has (for login_count etc)
  try {
    const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`);
    console.log('\nusers columns:', cols.rows.map(r => r.column_name).join(', '));
  } catch(e) { console.error('columns check failed:', e.message); }

  process.exit(0);
}

run();
