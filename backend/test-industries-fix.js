const pool = require('./src/config/db');

pool.query(
  `SELECT i.id, i.company_name, i.sector, i.location,
          COUNT(DISTINCT p.id) AS product_count
   FROM industries i
   JOIN users u ON u.id = i.user_id
   LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = true
   WHERE u.status = $1
   GROUP BY i.id, i.company_name, i.sector, i.location
   ORDER BY i.created_at DESC
   LIMIT $2 OFFSET $3`,
  ['approved', 20, 0]
).then(r => {
  console.log('✅ Query OK — rows returned:', r.rows.length);
  if (r.rows.length > 0) console.log('Sample:', r.rows[0].company_name, r.rows[0].sector);
  process.exit(0);
}).catch(e => {
  console.error('❌ Query FAILED:', e.message);
  process.exit(1);
});
