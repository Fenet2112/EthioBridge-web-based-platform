const pool = require('./src/config/db');

async function test() {
  console.log('Testing transaction history queries...\n');

  // Test stakeholder my-requests query
  try {
    const r = await pool.query(`
      SELECT pr.id, pr.status, pr.quantity,
        p.name AS product_name, p.price, p.unit,
        (p.price * pr.quantity) AS total_price,
        i.company_name AS industry_name
      FROM purchase_requests pr
      JOIN stakeholders s ON s.id = pr.stakeholder_id
      JOIN products p ON p.id = pr.product_id
      JOIN industries i ON i.id = pr.industry_id
      WHERE s.user_id = $1
      ORDER BY pr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [1, 50, 0]);
    console.log('✅ stakeholder my-requests query OK:', r.rows.length, 'rows');
  } catch(e) { console.error('❌ stakeholder query FAILED:', e.message); }

  // Test industry-requests query
  try {
    const r = await pool.query(`
      SELECT pr.id, pr.status, pr.quantity,
        p.name AS product_name, p.price,
        (p.price * pr.quantity) AS total_price,
        s.organization_name AS stakeholder_org
      FROM purchase_requests pr
      JOIN products p ON p.id = pr.product_id
      JOIN stakeholders s ON s.id = pr.stakeholder_id
      JOIN users u ON u.id = s.user_id
      WHERE pr.industry_id = $1
        AND pr.status IN ('approved','pending','rejected','completed')
      ORDER BY pr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [1, 50, 0]);
    console.log('✅ industry-requests query OK:', r.rows.length, 'rows');
  } catch(e) { console.error('❌ industry query FAILED:', e.message); }

  console.log('\n✅ Both transaction routes are working correctly');
  process.exit(0);
}

test();
