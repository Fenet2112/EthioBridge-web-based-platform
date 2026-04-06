const pool = require('./src/config/db');

async function verifyPendingUsers() {
  try {
    console.log('Checking pending users that will appear in Admin Approval section...\n');
    
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.status,
        i.company_name,
        i.sector,
        s.organization_name,
        s.organization_type
      FROM users u
      LEFT JOIN industries i ON i.user_id = u.id
      LEFT JOIN stakeholders s ON s.user_id = u.id
      WHERE u.status = 'pending'
      ORDER BY u.created_at DESC
    `);
    
    console.log(`✓ Found ${result.rows.length} pending users\n`);
    
    if (result.rows.length > 0) {
      console.log('These users will appear in Admin Approval section:');
      console.log('='.repeat(80));
      
      result.rows.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.role.toUpperCase()}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Status: ${user.status}`);
        
        if (user.role === 'industry') {
          console.log(`   Company: ${user.company_name || '(Not completed yet)'}`);
          console.log(`   Sector: ${user.sector || '(Not completed yet)'}`);
        } else {
          console.log(`   Organization: ${user.organization_name || '(Not completed yet)'}`);
          console.log(`   Type: ${user.organization_type || '(Not completed yet)'}`);
        }
      });
      
      console.log('\n' + '='.repeat(80));
      
      const withProfile = result.rows.filter(u => 
        (u.role === 'industry' && u.company_name) || 
        (u.role === 'stakeholder' && u.organization_name)
      ).length;
      
      const withoutProfile = result.rows.length - withProfile;
      
      console.log(`\n📊 Summary:`);
      console.log(`   - Users with completed profiles: ${withProfile}`);
      console.log(`   - Users without profiles: ${withoutProfile}`);
      console.log(`   - Total pending users: ${result.rows.length}`);
      console.log(`\n✅ All ${result.rows.length} users will appear in Admin Approval section!`);
    } else {
      console.log('No pending users found.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyPendingUsers();
