require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('./src/config/db');

const email = process.argv[2] || 'netsu@gmail.com';

pool.query('SELECT * FROM users WHERE email = $1', [email])
.then(r => {
  if (r.rows.length === 0) {
    console.log('User not found');
    process.exit(1);
  }
  
  const user = r.rows[0];
  console.log('User found:', user.email, 'Status:', user.status);
  
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, status: user.status },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    { expiresIn: '7d' }
  );
  
  console.log('\n✅ Fresh Token Generated!');
  console.log('\nCopy this token and use it:');
  console.log(token);
  console.log('\nTo use it:');
  console.log('1. Open browser console (F12)');
  console.log('2. Type: localStorage.setItem("token", "' + token + '")');
  console.log('3. Type: localStorage.setItem("user", \'' + JSON.stringify({id: user.id, email: user.email, role: user.role, status: user.status}) + '\')');
  console.log('4. Refresh the page');
  
  process.exit(0);
})
.catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
