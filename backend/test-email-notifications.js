require('dotenv').config();
const {
  sendVerificationEmail,
  sendSignupNotification,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPurchaseApprovedEmail,
  sendPurchaseRejectedEmail,
  sendSuspensionEmail,
  sendPasswordResetEmail,
} = require('./src/utils/sendEmail');

/**
 * Test script for all email notification types
 * 
 * Usage:
 *   node test-email-notifications.js <email> <test-type>
 * 
 * Test types:
 *   all              - Test all email types
 *   verification     - Test verification email
 *   signup           - Test signup notification
 *   approval         - Test approval email
 *   rejection        - Test rejection email
 *   purchase-approve - Test purchase approved email
 *   purchase-reject  - Test purchase rejected email
 *   suspension       - Test suspension email
 *   ban              - Test ban email
 *   password-reset   - Test password reset email
 */

const testEmail = process.argv[2] || 'test@example.com';
const testType = process.argv[3] || 'all';

console.log('\n=== EthioBridge Email Notification Test ===\n');
console.log(`Test Email: ${testEmail}`);
console.log(`Test Type: ${testType}`);
console.log(`\nEnvironment Check:`);
console.log(`  EMAIL_USER: ${process.env.EMAIL_USER ? '✓ Set' : '✗ Not set'}`);
console.log(`  EMAIL_PASS: ${process.env.EMAIL_PASS ? '✓ Set' : '✗ Not set'}`);
console.log(`  APP_URL: ${process.env.APP_URL || 'http://localhost:3000'}`);
console.log(`  BACKEND_URL: ${process.env.BACKEND_URL || 'http://localhost:5000'}`);
console.log('\n');

async function testVerificationEmail() {
  console.log('📧 Testing Verification Email...');
  try {
    const token = 'test-token-' + Date.now();
    await sendVerificationEmail(testEmail, token);
    console.log('✓ Verification email sent successfully\n');
  } catch (error) {
    console.error('✗ Verification email failed:', error.message, '\n');
  }
}

async function testSignupNotification() {
  console.log('📧 Testing Signup Notification...');
  try {
    await sendSignupNotification(testEmail);
    console.log('✓ Signup notification sent successfully\n');
  } catch (error) {
    console.error('✗ Signup notification failed:', error.message, '\n');
  }
}

async function testApprovalEmail() {
  console.log('📧 Testing Approval Email...');
  try {
    await sendApprovalEmail(testEmail, 'Test Company Ltd');
    console.log('✓ Approval email sent successfully\n');
  } catch (error) {
    console.error('✗ Approval email failed:', error.message, '\n');
  }
}

async function testRejectionEmail() {
  console.log('📧 Testing Rejection Email...');
  try {
    await sendRejectionEmail(
      testEmail,
      'Test Company Ltd',
      'Incomplete business registration documents. Please provide valid trade license.'
    );
    console.log('✓ Rejection email sent successfully\n');
  } catch (error) {
    console.error('✗ Rejection email failed:', error.message, '\n');
  }
}

async function testPurchaseApprovedEmail() {
  console.log('📧 Testing Purchase Approved Email...');
  try {
    await sendPurchaseApprovedEmail(
      testEmail,
      'Cement - 50kg bags',
      'ABC Construction Materials'
    );
    console.log('✓ Purchase approved email sent successfully\n');
  } catch (error) {
    console.error('✗ Purchase approved email failed:', error.message, '\n');
  }
}

async function testPurchaseRejectedEmail() {
  console.log('📧 Testing Purchase Rejected Email...');
  try {
    await sendPurchaseRejectedEmail(
      testEmail,
      'Cement - 50kg bags',
      'ABC Construction Materials',
      'Product currently out of stock. Please try again next week.'
    );
    console.log('✓ Purchase rejected email sent successfully\n');
  } catch (error) {
    console.error('✗ Purchase rejected email failed:', error.message, '\n');
  }
}

async function testSuspensionEmail() {
  console.log('📧 Testing Suspension Email...');
  try {
    await sendSuspensionEmail(
      testEmail,
      'suspended',
      'Multiple reports of fraudulent activity. Account suspended pending investigation.'
    );
    console.log('✓ Suspension email sent successfully\n');
  } catch (error) {
    console.error('✗ Suspension email failed:', error.message, '\n');
  }
}

async function testBanEmail() {
  console.log('📧 Testing Ban Email...');
  try {
    await sendSuspensionEmail(
      testEmail,
      'banned',
      'Violation of terms of service: Posting fake products and scamming buyers.'
    );
    console.log('✓ Ban email sent successfully\n');
  } catch (error) {
    console.error('✗ Ban email failed:', error.message, '\n');
  }
}

async function testPasswordResetEmail() {
  console.log('📧 Testing Password Reset Email...');
  try {
    const token = 'reset-token-' + Date.now();
    await sendPasswordResetEmail(testEmail, token);
    console.log('✓ Password reset email sent successfully\n');
  } catch (error) {
    console.error('✗ Password reset email failed:', error.message, '\n');
  }
}

async function runTests() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ ERROR: EMAIL_USER and EMAIL_PASS must be set in .env file');
    console.error('\nPlease configure:');
    console.error('  EMAIL_USER=your-email@gmail.com');
    console.error('  EMAIL_PASS=your-16-char-app-password');
    console.error('\nSee: https://support.google.com/accounts/answer/185833');
    process.exit(1);
  }

  try {
    switch (testType.toLowerCase()) {
      case 'verification':
        await testVerificationEmail();
        break;
      case 'signup':
        await testSignupNotification();
        break;
      case 'approval':
        await testApprovalEmail();
        break;
      case 'rejection':
        await testRejectionEmail();
        break;
      case 'purchase-approve':
        await testPurchaseApprovedEmail();
        break;
      case 'purchase-reject':
        await testPurchaseRejectedEmail();
        break;
      case 'suspension':
        await testSuspensionEmail();
        break;
      case 'ban':
        await testBanEmail();
        break;
      case 'password-reset':
        await testPasswordResetEmail();
        break;
      case 'all':
        await testVerificationEmail();
        await testSignupNotification();
        await testApprovalEmail();
        await testRejectionEmail();
        await testPurchaseApprovedEmail();
        await testPurchaseRejectedEmail();
        await testSuspensionEmail();
        await testBanEmail();
        await testPasswordResetEmail();
        break;
      default:
        console.error(`Unknown test type: ${testType}`);
        console.error('Valid types: all, verification, signup, approval, rejection, purchase-approve, purchase-reject, suspension, ban, password-reset');
        process.exit(1);
    }

    console.log('=== Test Complete ===');
    console.log(`\nCheck ${testEmail} inbox for test emails.`);
    console.log('Remember to check spam folder if emails don\'t appear in inbox.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
