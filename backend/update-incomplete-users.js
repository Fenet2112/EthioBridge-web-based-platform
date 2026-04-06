const pool = require('./src/config/db');

async function updateIncompleteUsers() {
  try {
    console.log('Updating users with incomplete status to pending...');
    
    const result = await pool.query(
      "UPDATE users SET status = 'pending' WHERE status = 'incomplete' RETURNING id, email, status"
    );
    
    console.log(`✓ Updated ${result.rowCount} users from 'incomplete' to 'pending'`);
    
    if (result.rows.length > 0) {
      console.log('\nUpdated users:');
      result.rows.forEach(user => {
        console.log(`  - ID: ${user.id}, Email: ${user.email}, Status: ${user.status}`);
      });
    }
    
    // Show all users
    const allUsers = await pool.query(
      'SELECT id, email, role, status FROM users ORDER BY id'
    );
    
    console.log('\n📊 All users in database:');
    console.log('ID | Email | Role | Status');
    console.log('---|-------|------|-------');
    allUsers.rows.forEach(user => {
      console.log(`${user.id} | ${user.email} | ${user.role} | ${user.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateIncompleteUsers();
