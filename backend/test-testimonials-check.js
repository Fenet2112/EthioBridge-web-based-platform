const pool = require('./src/config/db');

async function check() {
  const all = await pool.query('SELECT id, name, status, approved_at FROM testimonials ORDER BY id');
  console.log('All testimonials:');
  all.rows.forEach(t => console.log(` id=${t.id} status="${t.status}" name="${t.name}" approved_at=${t.approved_at}`));

  // Simulate the FIXED /approved endpoint query
  const approved = await pool.query(`
    SELECT id, name, role, message, rating,
           COALESCE(approved_at, created_at) AS created_at
    FROM testimonials
    WHERE status = 'approved'
      AND name IS NOT NULL AND TRIM(name) <> ''
      AND message IS NOT NULL AND TRIM(message) <> ''
    ORDER BY COALESCE(approved_at, created_at) DESC
    LIMIT 20
  `);
  console.log('\nFixed /api/testimonials/approved returns:', approved.rows.length, 'rows');
  approved.rows.forEach(t => console.log(` id=${t.id} name="${t.name}" date=${t.created_at}`));

  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
