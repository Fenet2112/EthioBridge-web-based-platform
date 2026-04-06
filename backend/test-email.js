require('dotenv').config();
const { sendVerificationEmail } = require('./src/utils/sendEmail');

console.log('='.repeat(60));
console.log('Gmail SMTP Email Test');
console.log('='.repeat(60));
console.log('');
console.log('Configuration:');
console.log(`  EMAIL_USER: ${process.env.EMAIL_USER || '❌ NOT SET'}`);
console.log(`  EMAIL_PASS: ${process.env.EMAIL_PASS ? '✓ SET (hidden)' : '❌ NOT SET'}`);
console.log(`  BACKEND_URL: ${process.env.BACKEND_URL || 'http://localhost:5000'}`);
console.log('');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('❌ ERROR: EMAIL_USER and EMAIL_PASS must be set in .env file');
  console.error('');
  console.error('Steps to fix:');
  console.error('1. Enable 2-Step Verification on your Gmail account');
  console.error('2. Generate App Password at: https://myaccount.google.com/apppasswords');
  console.error('3. Add to backend/.env:');
  console.error('   EMAIL_USER=your-email@gmail.com');
  console.error('   EMAIL_PASS=your-16-char-app-password');
  console.error('');
  process.exit(1);
}

async function testEmail() {
  try {
    console.log('Testing email verification...');
    console.log('');
    
    const testEmail = process.env.EMAIL_USER; // Send to yourself for testing
    const testToken = 'test-token-' + Date.now();
    
    console.log(`Sending test verification email to: ${testEmail}`);
    console.log('');
    
    await sendVerificationEmail(testEmail, testToken);
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✓ SUCCESS! Email sent successfully');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('1. Check your inbox: ' + testEmail);
    console.log('2. Check spam/junk folder if not in inbox');
    console.log('3. Click the verification link to test the flow');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ FAILED! Email sending failed');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    
    if (error.message.includes('Invalid login')) {
      console.error('Common causes:');
      console.error('1. Using regular Gmail password instead of App Password');
      console.error('2. App Password not generated correctly');
      console.error('3. 2-Step Verification not enabled');
      console.error('');
      console.error('Solution:');
      console.error('- Go to: https://myaccount.google.com/apppasswords');
      console.error('- Generate a new App Password');
      console.error('- Update EMAIL_PASS in .env with the 16-character password');
    } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.error('Common causes:');
      console.error('1. Firewall blocking port 587');
      console.error('2. Network connectivity issues');
      console.error('3. ISP blocking SMTP ports');
      console.error('');
      console.error('Solution:');
      console.error('- Try from a different network');
      console.error('- Check firewall settings');
      console.error('- Contact your hosting provider');
    }
    console.error('');
    process.exit(1);
  }
}

testEmail();
