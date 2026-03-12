// Test script to verify the status endpoint works
require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Create a test token with old status
const testToken = jwt.sign(
  {
    id: 1,
    email: 'test@example.com',
    role: 'stakeholder',
    status: 'pending'  // Old status
  },
  JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('\n=== JWT Token Status Test ===\n');
console.log('Test Token (with old status "pending"):');
console.log(testToken);
console.log('\n');

// Decode the token to show what's inside
const decoded = jwt.verify(testToken, JWT_SECRET);
console.log('Decoded Token Payload:');
console.log(JSON.stringify(decoded, null, 2));
console.log('\n');

console.log('To test the fix:');
console.log('1. Start the backend server: npm start');
console.log('2. Use this token in the Authorization header');
console.log('3. Make a request to: GET http://localhost:5000/api/profile/stakeholder/status');
console.log('4. The endpoint should return the CURRENT status from database, not from token');
console.log('\n');

console.log('Example curl command:');
console.log(`curl -H "Authorization: Bearer ${testToken}" http://localhost:5000/api/profile/stakeholder/status`);
console.log('\n');
