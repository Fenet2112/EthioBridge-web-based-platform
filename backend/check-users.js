const pool = require('./src/config/db');

pool.query(`
  SELECT id, email, status, role 
  FROM users 
  WHERE role = 'stakeholder' 
  ORDER BY created_at DESC 
  LIMIT 5
`)
.then(r => {
  console.log('Stakeholders:');
  r.rows.forEach(u => {
    console.log(`  ID: ${u.id}, Email: ${u.email}, Status: ${u.status}`);
  });
  process.exit(0);
})
.catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
