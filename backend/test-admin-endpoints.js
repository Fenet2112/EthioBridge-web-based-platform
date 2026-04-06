require('dotenv').config();
const fetch = require('node-fetch');

const API_BASE = process.env.BACKEND_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ethiobridge.et';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fen@1234';

console.log('='.repeat(60));
console.log('Testing Admin Endpoints');
console.log('='.repeat(60));
console.log('');
console.log(`API Base: ${API_BASE}`);
console.log(`Admin Email: ${ADMIN_EMAIL}`);
console.log('');

async function testAdminEndpoints() {
  try {
    // Step 1: Login as admin
    console.log('Step 1: Logging in as admin...');
    const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    if (!loginRes.ok) {
      const error = await loginRes.text();
      throw new Error(`Admin login failed: ${loginRes.status} - ${error}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✓ Admin login successful');
    console.log('');

    // Step 2: Test /api/admin/pending
    console.log('Step 2: Testing GET /api/admin/pending...');
    const pendingRes = await fetch(`${API_BASE}/api/admin/pending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!pendingRes.ok) {
      const error = await pendingRes.text();
      throw new Error(`Pending endpoint failed: ${pendingRes.status} - ${error}`);
    }

    const pendingData = await pendingRes.json();
    console.log(`✓ Found ${pendingData.length} pending users`);
    if (pendingData.length > 0) {
      console.log('  Sample:', {
        id: pendingData[0].id,
        email: pendingData[0].email,
        role: pendingData[0].role,
        status: pendingData[0].status
      });
    }
    console.log('');

    // Step 3: Test /api/admin/users
    console.log('Step 3: Testing GET /api/admin/users...');
    const usersRes = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!usersRes.ok) {
      const error = await usersRes.text();
      throw new Error(`Users endpoint failed: ${usersRes.status} - ${error}`);
    }

    const usersData = await usersRes.json();
    console.log(`✓ Found ${usersData.length} total users`);
    if (usersData.length > 0) {
      console.log('  Sample:', {
        id: usersData[0].id,
        email: usersData[0].email,
        role: usersData[0].role,
        status: usersData[0].status
      });
    }
    console.log('');

    // Step 4: Test /api/admin/users/all
    console.log('Step 4: Testing GET /api/admin/users/all...');
    const allUsersRes = await fetch(`${API_BASE}/api/admin/users/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!allUsersRes.ok) {
      const error = await allUsersRes.text();
      throw new Error(`Users/all endpoint failed: ${allUsersRes.status} - ${error}`);
    }

    const allUsersData = await allUsersRes.json();
    console.log(`✓ Found ${allUsersData.length} users for management`);
    if (allUsersData.length > 0) {
      console.log('  Sample:', {
        id: allUsersData[0].id,
        email: allUsersData[0].email,
        role: allUsersData[0].role,
        status: allUsersData[0].status,
        display_name: allUsersData[0].display_name
      });
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('✓ All admin endpoints working correctly!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Test failed!');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

testAdminEndpoints();
