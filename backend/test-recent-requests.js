require('dotenv').config();
const jwt = require('jsonwebtoken');

const API_BASE_URL = process.env.API_BASE_URL || 'https://ethiobridge-web-based-platform.onrender.com';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Test script to diagnose 403 error on /api/industry/recent-requests endpoint
 * 
 * This script will:
 * 1. Check if a valid industry user exists in the database
 * 2. Generate a JWT token for that user
 * 3. Test the recent-requests endpoint with the token
 * 4. Display detailed error information
 */

async function testRecentRequestsEndpoint() {
  console.log('\n=== Testing Recent Requests Endpoint ===\n');
  
  try {
    // Step 1: Find an approved industry user
    console.log('Step 1: Finding an approved industry user...');
    const pool = require('./src/config/db');
    
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.role, u.status, i.id as industry_id, i.company_name
       FROM users u
       LEFT JOIN industries i ON i.user_id = u.id
       WHERE u.role = 'industry' AND u.status = 'approved'
       LIMIT 1`
    );
    
    if (userResult.rows.length === 0) {
      console.error('❌ No approved industry users found in database');
      console.log('\nPossible solutions:');
      console.log('1. Make sure at least one industry user is approved by admin');
      console.log('2. Check the users table: SELECT * FROM users WHERE role = \'industry\';');
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log('✓ Found user:', {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      industry_id: user.industry_id,
      company_name: user.company_name
    });
    
    // Step 2: Generate JWT token
    console.log('\nStep 2: Generating JWT token...');
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('✓ Token generated');
    console.log('Token preview:', token.substring(0, 50) + '...');
    
    // Step 3: Test the endpoint
    console.log('\nStep 3: Testing /api/industry/recent-requests endpoint...');
    const fetch = require('node-fetch');
    
    const response = await fetch(`${API_BASE_URL}/api/industry/recent-requests`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status, response.statusText);
    
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }
    
    if (response.ok) {
      console.log('✓ SUCCESS! Endpoint returned data:');
      console.log(JSON.stringify(responseData, null, 2));
    } else {
      console.log('❌ FAILED! Error response:');
      console.log(JSON.stringify(responseData, null, 2));
      
      console.log('\n=== Diagnosis ===');
      if (response.status === 401) {
        console.log('401 Unauthorized - Token is missing or invalid');
        console.log('- Check if JWT_SECRET matches between frontend and backend');
        console.log('- Verify token is being sent in Authorization header');
      } else if (response.status === 403) {
        console.log('403 Forbidden - Token is valid but user lacks permission');
        console.log('Possible causes:');
        console.log('1. User role is not "industry"');
        console.log('2. User status is not "approved"');
        console.log('3. Industry profile does not exist for this user');
        console.log('4. Middleware chain is blocking the request');
        
        // Additional checks
        console.log('\n=== Additional Checks ===');
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Token payload:', decoded);
        
        // Check if industry profile exists
        const industryCheck = await pool.query(
          'SELECT * FROM industries WHERE user_id = $1',
          [user.id]
        );
        console.log('Industry profile exists:', industryCheck.rows.length > 0);
        if (industryCheck.rows.length > 0) {
          console.log('Industry details:', industryCheck.rows[0]);
        }
      }
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
  }
}

// Run the test
testRecentRequestsEndpoint();
