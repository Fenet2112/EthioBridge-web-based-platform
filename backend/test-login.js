require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/config/db');
const jwt = require('jsonwebtoken');

async function testLogin() {
  try {
    console.log('Testing login for abel@gmail.com...');
    
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', ['abel@gmail.com']);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No user found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✓ User found:', user.email);
    console.log('✓ User role:', user.role);
    console.log('✓ User status:', user.status);
    console.log('✓ Has password:', !!user.password);
    
    // Test password comparison
    try {
      const testPassword = 'password123';
      const valid = await bcrypt.compare(testPassword, user.password);
      console.log(`✓ Password compare works. Testing '${testPassword}':`, valid);
    } catch (e) {
      console.log('❌ Bcrypt error:', e.message);
    }
    
    // Test JWT
    try {
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, status: user.status },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        { expiresIn: '7d' }
      );
      console.log('✓ JWT token generated successfully');
    } catch (e) {
      console.log('❌ JWT error:', e.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    process.exit(0);
  }
}

testLogin();
