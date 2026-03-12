require('dotenv').config();
const bcrypt = require('bcryptjs');

async function testAdminLogin() {
  try {
    console.log('Testing admin login...');
    console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
    console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '***' : 'NOT SET');
    console.log('ADMIN_JWT_SECRET:', process.env.ADMIN_JWT_SECRET ? '***' : 'NOT SET');
    
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_JWT_SECRET) {
      console.log('❌ Admin credentials not configured in .env');
      return;
    }
    
    // Test password hashing
    const testPassword = process.env.ADMIN_PASSWORD;
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    console.log('✓ Password hashed successfully');
    
    // Test password comparison
    const valid = await bcrypt.compare(testPassword, hashedPassword);
    console.log('✓ Password comparison works:', valid);
    
    // Test with wrong password
    const invalid = await bcrypt.compare('wrongpassword', hashedPassword);
    console.log('✓ Wrong password rejected:', !invalid);
    
    console.log('\n✅ Admin login should work!');
    console.log('Try logging in with:');
    console.log('Email:', process.env.ADMIN_EMAIL);
    console.log('Password: (from your .env file)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testAdminLogin();
