require('dotenv').config();
const pool = require('./src/config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const API_BASE_URL = process.env.API_URL || "http://localhost:5000";

async function testIndustryFlow() {
  console.log('\n=== TESTING INDUSTRY FLOW ===\n');
  
  const testEmail = `test-industry-${Date.now()}@test.com`;
  const testPassword = 'Test123!';
  
  try {
    // Step 1: Create industry user
    console.log('Step 1: Creating industry user...');
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const userResult = await pool.query(
      `INSERT INTO users (email, password, role, status, email_verified) 
       VALUES ($1, $2, 'industry', 'incomplete', true) 
       RETURNING id, email, role, status`,
      [testEmail, hashedPassword]
    );
    
    const user = userResult.rows[0];
    console.log('✓ User created:', user);
    
    // Step 2: Create industry profile
    console.log('\nStep 2: Creating industry profile...');
    const industryResult = await pool.query(
      `INSERT INTO industries (user_id, company_name, sector, location, phone, description) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [user.id, 'Test Company Ltd', 'Construction Materials Supplier', 'Addis Ababa', '+251911234567', 'Test company description']
    );
    
    const industry = industryResult.rows[0];
    console.log('✓ Industry profile created:', { id: industry.id, company_name: industry.company_name });
    
    // Step 3: Check status before approval
    console.log('\nStep 3: Checking status BEFORE approval...');
    const statusBefore = await pool.query(
      `SELECT u.status, i.company_name 
       FROM users u 
       LEFT JOIN industries i ON i.user_id = u.id 
       WHERE u.id = $1`,
      [user.id]
    );
    console.log('Status before approval:', statusBefore.rows[0]);
    
    // Step 4: Simulate admin approval
    console.log('\nStep 4: Simulating admin approval...');
    await pool.query(
      `UPDATE users SET status = 'approved' WHERE id = $1`,
      [user.id]
    );
    
    // Step 5: Check status after approval
    console.log('\nStep 5: Checking status AFTER approval...');
    const statusAfter = await pool.query(
      `SELECT u.id, u.email, u.role, u.status, i.company_name 
       FROM users u 
       LEFT JOIN industries i ON i.user_id = u.id 
       WHERE u.id = $1`,
      [user.id]
    );
    console.log('Status after approval:', statusAfter.rows[0]);
    
    // Step 6: Generate JWT token
    console.log('\nStep 6: Generating JWT token...');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, status: 'approved' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    console.log('✓ Token generated');
    
    // Step 7: Simulate what the API endpoint returns
    console.log('\nStep 7: Simulating /profile/industry/status endpoint response...');
    
    const apiSimulation = await pool.query(
      `SELECT u.status, i.* 
       FROM users u 
       LEFT JOIN industries i ON i.user_id = u.id 
       WHERE u.id = $1`,
      [user.id]
    );
    
    const statusData = {
      status: apiSimulation.rows[0].status,
      profile: apiSimulation.rows[0]
    };
    console.log('API Response (simulated):', JSON.stringify(statusData, null, 2));
    
    // Step 8: Verify the issue
    console.log('\n=== VERIFICATION ===');
    console.log('Expected status: approved');
    console.log('Actual status:', statusData.status);
    console.log('Match:', statusData.status === 'approved' ? '✓ CORRECT' : '✗ INCORRECT');
    
    // Step 9: Check what's in localStorage simulation
    console.log('\n=== SIMULATING FRONTEND BEHAVIOR ===');
    const userData = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: statusData.status
    };
    console.log('localStorage user data would be:', JSON.stringify(userData, null, 2));
    console.log('profileStatus would be set to:', statusData.status);
    console.log('showPendingBanner would be:', statusData.status === 'pending');
    console.log('Banner should show:', statusData.status === 'pending' ? 'YES' : 'NO');
    
    // Cleanup
    console.log('\n=== CLEANUP ===');
    await pool.query('DELETE FROM industries WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log('✓ Test data cleaned up');
    
    console.log('\n=== TEST COMPLETE ===\n');
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await pool.end();
  }
}

testIndustryFlow();
