require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing email configuration...');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function testEmail() {
  try {
    console.log('\n1. Verifying SMTP connection...');
    await transporter.verify();
    console.log('✓ SMTP connection verified successfully!');

    console.log('\n2. Sending test email...');
    const info = await transporter.sendMail({
      from: `"EthioBridge Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'Test Email from EthioBridge',
      html: '<h1>Test Email</h1><p>If you receive this, email is working!</p>',
    });

    console.log('✓ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\nCheck your inbox at:', process.env.EMAIL_USER);
  } catch (error) {
    console.error('\n✗ Email test FAILED:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'EAUTH') {
      console.error('\n⚠ Authentication failed. Possible issues:');
      console.error('  1. Wrong email password');
      console.error('  2. Gmail "Less secure app access" is disabled');
      console.error('  3. Need to use App Password instead of regular password');
      console.error('\nTo fix:');
      console.error('  1. Go to https://myaccount.google.com/security');
      console.error('  2. Enable 2-Step Verification');
      console.error('  3. Generate an App Password');
      console.error('  4. Use the App Password in EMAIL_PASS');
    }
  }
}

testEmail();
