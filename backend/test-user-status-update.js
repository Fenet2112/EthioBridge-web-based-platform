require('dotenv').config();
const jwt = require('jsonwebtoken');

/**
 * Test script for user status update endpoint
 * Tests the PATCH /api/admin/users/:id/status endpoint
 */

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET;

if (!ADMIN_SECRET) {
  console.error('❌ ADMIN_JWT_SECRET not set in .env');
  process.exit(1);
}

// Generate admin token
const adminToken = jwt.sign(
  { id: 0, email: 'admin@ethiobridge.et', role: 'admin' },
  ADMIN_SECRET,
  { expiresIn: '1h' }
);

async function testStatusUpdate() {
  console.log('\n=== Testing User Status Update Endpoint ===\n');
  
  try {
    // Use axios which is already installed
    const axios = require('axios');
    
    // First, get a user to test with
    console.log('Step 1: Fetching users...');
    const usersResponse = await axios.get(`${API_BASE_URL}/api/admin/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    const users = usersResponse.data;
    console.log(`✓ Found ${users.length} users`);
    
    if (users.length === 0) {
      console.log('⚠️  No users found to test with');
      process.exit(0);
    }
    
    const testUser = users[0];
    console.log(`\nTest user: ${testUser.email} (ID: ${testUser.id}, Status: ${testUser.status})`);
    
    // Test 1: Suspend user
    console.log('\n--- Test 1: Suspend User ---');
    const suspendResponse = await axios.patch(
      `${API_BASE_URL}/api/admin/users/${testUser.id}/status`,
      {
        status: 'suspended',
        ban_reason: 'Test suspension - automated test',
        suspended_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`Response status: ${suspendResponse.status}`);
    console.log('Response:', JSON.stringify(suspendResponse.data, null, 2));
    console.log('✓ User suspended successfully');
    
    // Test 2: Reactivate user (restore to approved)
    console.log('\n--- Test 2: Reactivate User ---');
    const reactivateResponse = await axios.patch(
      `${API_BASE_URL}/api/admin/users/${testUser.id}/status`,
      {
        status: 'approved',
        ban_reason: null,
        suspended_until: null
      },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`Response status: ${reactivateResponse.status}`);
    console.log('Response:', JSON.stringify(reactivateResponse.data, null, 2));
    console.log('✓ User reactivated successfully');
    
    console.log('\n=== Test Complete ===\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testStatusUpdate();
