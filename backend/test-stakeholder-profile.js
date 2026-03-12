require('dotenv').config();
const pool = require('./src/config/db');

async function testStakeholderProfile() {
  try {
    console.log('Testing stakeholder profile submission...');
    
    // Test data
    const testData = {
      user_id: 18, // netsu@gmail.com
      organization_name: "Test Organization",
      organization_type: "Contractor",
      location: "Addis Ababa",
      description: "Test description",
      phone: "0911234567",
      contact_person: "Test Person"
    };
    
    console.log('Test data:', testData);
    
    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [testData.user_id]);
    console.log('User exists:', userCheck.rows.length > 0);
    console.log('User role:', userCheck.rows[0]?.role);
    console.log('User status:', userCheck.rows[0]?.status);
    
    // Try to insert stakeholder profile
    const result = await pool.query(
      `INSERT INTO stakeholders (user_id, organization_name, organization_type, location, description, phone, contact_person)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         organization_name = EXCLUDED.organization_name,
         organization_type = EXCLUDED.organization_type,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         phone = EXCLUDED.phone,
         contact_person = EXCLUDED.contact_person
       RETURNING *`,
      [testData.user_id, testData.organization_name, testData.organization_type, testData.location, testData.description, testData.phone, testData.contact_person]
    );
    
    console.log('✓ Profile inserted:', result.rows[0]);
    
    // Update user status
    const statusUpdate = await pool.query('UPDATE users SET status = \'pending\' WHERE id = $1 RETURNING status', [testData.user_id]);
    console.log('✓ Status updated to:', statusUpdate.rows[0].status);
    
    console.log('\n✅ Test successful!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    process.exit(0);
  }
}

testStakeholderProfile();
