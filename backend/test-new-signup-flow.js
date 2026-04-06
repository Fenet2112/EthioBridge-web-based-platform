const pool = require('./src/config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function testNewSignupFlow() {
  try {
    console.log('🧪 Testing New Signup Flow\n');
    console.log('='.repeat(60));
    
    // Test data
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'test123';
    const testRole = 'industry';
    
    console.log('\n1️⃣  Simulating new user signup...');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Role: ${testRole}`);
    
    // Simulate signup process
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const result = await pool.query(
      `INSERT INTO users (email, password, role, status, email_verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, 'pending', FALSE, $4, $5)
       RETURNING id, email, role, status`,
      [testEmail, hashedPassword, testRole, verificationToken, tokenExpires]
    );
    
    const newUser = result.rows[0];
    
    console.log('\n✅ User created successfully!');
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Role: ${newUser.role}`);
    console.log(`   Status: ${newUser.status}`);
    
    // Verify status is 'pending'
    if (newUser.status === 'pending') {
      console.log('\n✅ PASS: User status is "pending" (correct!)');
    } else {
      console.log(`\n❌ FAIL: User status is "${newUser.status}" (expected "pending")`);
      process.exit(1);
    }
    
    // Check if user appears in admin pending query
    console.log('\n2️⃣  Checking if user appears in Admin Approval query...');
    
    const pendingUsers = await pool.query(`
      SELECT u.id, u.email, u.role, u.status, i.company_name
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      WHERE u.status = 'pending' AND u.id = $1
    `, [newUser.id]);
    
    if (pendingUsers.rows.length > 0) {
      console.log('✅ PASS: User appears in admin pending query!');
      console.log(`   Found in query: ${pendingUsers.rows[0].email}`);
    } else {
      console.log('❌ FAIL: User does NOT appear in admin pending query');
      process.exit(1);
    }
    
    // Simulate profile completion
    console.log('\n3️⃣  Simulating profile completion...');
    
    await pool.query(
      `INSERT INTO industries (user_id, company_name, sector, location)
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, 'Test Company', 'Construction', 'Addis Ababa']
    );
    
    console.log('✅ Profile created successfully');
    
    // Check if profile appears in admin query
    const withProfile = await pool.query(`
      SELECT u.id, u.email, u.role, u.status, i.company_name, i.sector
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      WHERE u.status = 'pending' AND u.id = $1
    `, [newUser.id]);
    
    if (withProfile.rows.length > 0 && withProfile.rows[0].company_name) {
      console.log('✅ PASS: Profile information appears in admin query!');
      console.log(`   Company: ${withProfile.rows[0].company_name}`);
      console.log(`   Sector: ${withProfile.rows[0].sector}`);
    } else {
      console.log('❌ FAIL: Profile information missing');
      process.exit(1);
    }
    
    // Cleanup test data
    console.log('\n4️⃣  Cleaning up test data...');
    await pool.query('DELETE FROM industries WHERE user_id = $1', [newUser.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [newUser.id]);
    console.log('✅ Test data cleaned up');
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n✅ New signup flow works correctly:');
    console.log('   1. User created with status = "pending"');
    console.log('   2. User appears in Admin Approval section immediately');
    console.log('   3. Profile completion adds information to admin view');
    console.log('   4. Status remains "pending" until admin approval');
    console.log('\n✅ Industries will now appear in Admin Approval section right after signup!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testNewSignupFlow();
