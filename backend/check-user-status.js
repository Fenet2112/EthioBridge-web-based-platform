require('dotenv').config();
const pool = require('./src/config/db');

async function checkUserStatus() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('Usage: node check-user-status.js <email>');
    process.exit(1);
  }

  try {
    console.log(`\nChecking status for: ${email}\n`);
    
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.role,
        u.status,
        u.email_verified,
        u.created_at,
        CASE 
          WHEN u.role = 'industry' THEN i.company_name
          WHEN u.role = 'stakeholder' THEN s.organization_name
        END as name
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      WHERE u.email = $1
    `, [email]);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    const user = result.rows[0];
    
    console.log('═══════════════════════════════════════');
    console.log('USER INFORMATION');
    console.log('═══════════════════════════════════════');
    console.log(`ID:              ${user.id}`);
    console.log(`Email:           ${user.email}`);
    console.log(`Role:            ${user.role}`);
    console.log(`Status:          ${user.status}`);
    console.log(`Email Verified:  ${user.email_verified}`);
    console.log(`Name:            ${user.name || 'Not set'}`);
    console.log(`Created:         ${user.created_at}`);
    console.log('═══════════════════════════════════════\n');
    
    if (user.status === 'approved') {
      console.log('✅ User is APPROVED');
      console.log('   → Should have full access to all features');
      console.log('   → If getting 403 errors, user needs to log out and log back in');
      console.log('   → This will generate a fresh JWT token\n');
    } else if (user.status === 'pending') {
      console.log('⏳ User is PENDING approval');
      console.log('   → Waiting for admin to approve');
      console.log('   → Limited access until approved\n');
    } else if (user.status === 'incomplete') {
      console.log('📝 User profile is INCOMPLETE');
      console.log('   → User needs to complete their profile');
      console.log('   → Then submit for admin approval\n');
    } else {
      console.log(`⚠️  User status: ${user.status}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserStatus();
