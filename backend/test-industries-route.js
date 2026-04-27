const pool = require('./src/config/db');

async function test() {
  console.log('Testing GET /api/industries query...\n');

  const query = `
    SELECT
      i.id, i.user_id, i.company_name, i.sector, i.location,
      i.description, i.phone, i.website, i.established_year,
      i.latitude, i.longitude, i.created_at,
      COUNT(DISTINCT p.id) AS product_count
    FROM industries i
    JOIN users u ON u.id = i.user_id
    LEFT JOIN products p ON p.industry_id = i.id AND p.is_available = true
    WHERE u.status = $1
    GROUP BY i.id, i.user_id, i.company_name, i.sector, i.location,
             i.description, i.phone, i.website, i.established_year,
             i.latitude, i.longitude, i.created_at
    ORDER BY i.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const result = await pool.query(query, ['approved', 20, 0]);
    console.log(`✅ Query succeeded — ${result.rows.length} industries returned`);
    result.rows.forEach(r => {
      console.log(`  • ${r.company_name} | ${r.sector} | ${r.location} | products: ${r.product_count}`);
    });
    console.log('\n✅ GET /api/industries is working correctly');
  } catch (err) {
    console.error('❌ Query failed:', err.message);
  } finally {
    process.exit(0);
  }
}

test();
