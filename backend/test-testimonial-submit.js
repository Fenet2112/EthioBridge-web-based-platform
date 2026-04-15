// Test testimonial submission endpoint
require('dotenv').config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';

async function testSubmit() {
  console.log('Testing testimonial submission...\n');

  // First, you need a valid token. Replace this with a real token from localStorage
  const token = 'YOUR_TOKEN_HERE'; // Get this from browser localStorage after login

  try {
    const response = await fetch(`${API_BASE_URL}/api/testimonials/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: 'This is a test testimonial from the test script',
        rating: 5,
        role: 'stakeholder'
      })
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✓ Testimonial submitted successfully!');
    } else {
      console.log('\n✗ Failed to submit testimonial');
      console.log('Error:', data.message);
    }

  } catch (error) {
    console.error('✗ Request failed:', error.message);
  }
}

// Check if table exists
async function checkTable() {
  const pool = require('./src/config/db');
  
  try {
    console.log('Checking if testimonials table exists...');
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'testimonials'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('✓ Testimonials table exists\n');
      
      // Check table structure
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'testimonials'
        ORDER BY ordinal_position;
      `);
      
      console.log('Table columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
      console.log('');
      
    } else {
      console.log('✗ Testimonials table does NOT exist!');
      console.log('Run: node run-migrations.js');
    }
    
    await pool.end();
  } catch (error) {
    console.error('✗ Database check failed:', error.message);
  }
}

console.log('========================================');
console.log('Testimonial Submission Test');
console.log('========================================\n');

checkTable().then(() => {
  console.log('\nTo test submission:');
  console.log('1. Login to the app');
  console.log('2. Get token from localStorage');
  console.log('3. Replace YOUR_TOKEN_HERE in this script');
  console.log('4. Run: node backend/test-testimonial-submit.js');
});
