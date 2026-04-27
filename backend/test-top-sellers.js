const pool = require('./src/config/db');

pool.query(`
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
`).then(r => {
  console.log('✅ top-sellers query OK, rows:', r.rows.length);
  r.rows.forEach(row => console.log(` • ${row.industry_name} | revenue: ${row.total_revenue} | txns: ${row.total_transactions}`));
  process.exit(0);
}).catch(e => {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
});
