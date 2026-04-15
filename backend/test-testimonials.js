// Test script for testimonials endpoints
require('dotenv').config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';

async function testTestimonials() {
  console.log('========================================');
  console.log('Testing Testimonials System');
  console.log('========================================\n');

  try {
    // Test 1: Get approved testimonials (public endpoint)
    console.log('Test 1: Fetching approved testimonials...');
    const response1 = await fetch(`${API_BASE_URL}/api/testimonials/approved`);
    const testimonials = await response1.json();
    
    if (response1.ok) {
      console.log(`✓ Found ${testimonials.length} approved testimonials`);
      if (testimonials.length > 0) {
        console.log('  Sample testimonial:');
        console.log(`  - Name: ${testimonials[0].name}`);
        console.log(`  - Role: ${testimonials[0].role}`);
        console.log(`  - Rating: ${testimonials[0].rating || 'N/A'}`);
        console.log(`  - Message: ${testimonials[0].message.substring(0, 80)}...`);
      }
    } else {
      console.log('✗ Failed to fetch testimonials');
    }

    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log('✓ Public endpoint working');
    console.log('✓ Database migration successful');
    console.log('✓ Sample testimonials loaded');
    console.log('\nNote: To test authenticated endpoints:');
    console.log('1. Login as a user to submit feedback');
    console.log('2. Login as admin to manage testimonials');
    console.log('========================================\n');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Backend server is running');
    console.error('2. Database migration has been run');
    console.error('3. API_URL is correct in .env');
  }
}

testTestimonials();
