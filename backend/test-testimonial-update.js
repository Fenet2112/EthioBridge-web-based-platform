const pool = require('./src/config/db');

async function test() {
  try {
    // Test the fixed query
    const r = await pool.query(`
      UPDATE testimonials
      SET 
        status = $1,
        approved_by = $2,
        approved_at = CASE WHEN $3 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, name, status, approved_at
    `, ['approved', null, 'approved', 1]);
    
    console.log('✅ Query OK:', JSON.stringify(r.rows[0]));
    
    // Test reject
    const r2 = await pool.query(`
      UPDATE testimonials
      SET 
        status = $1,
        approved_by = $2,
        approved_at = CASE WHEN $3 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, name, status, approved_at
    `, ['rejected', null, 'rejected', 1]);
    
    console.log('✅ Reject query OK:', JSON.stringify(r2.rows[0]));
    
    // Restore to approved
    await pool.query("UPDATE testimonials SET status = 'approved' WHERE id = 1");
    console.log('✅ Restored to approved');
    
  } catch(e) {
    console.error('❌ FAILED:', e.message);
  } finally {
    process.exit(0);
  }
}

test();
