const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000, // 10 second timeout
  greetingTimeout: 10000,
});

const FROM = () => `"EthioBridge" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;
const APP  = () => process.env.APP_URL || 'http://localhost:3000';
const BACKEND = () => process.env.BACKEND_URL || 'http://localhost:5000';

// ── Shared HTML wrapper ──
const wrap = (title, body) => `
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0}
  .card{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#0a5c2f,#1a8a4a);padding:32px 36px;color:#fff}
  .header h1{margin:0;font-size:22px}
  .header p{margin:6px 0 0;opacity:.85;font-size:14px}
  .body{padding:32px 36px;color:#333;line-height:1.7;font-size:15px}
  .btn{display:inline-block;margin:20px 0;padding:13px 28px;background:#0a5c2f;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px}
  .footer{padding:20px 36px;background:#f8f9fa;color:#888;font-size:12px;border-top:1px solid #eee}
  .badge{display:inline-block;padding:4px 12px;border-radius:50px;font-size:13px;font-weight:700}
  .badge-green{background:#e8f5e9;color:#0a5c2f}
  .badge-red{background:#fff5f5;color:#dc2626}
  .badge-amber{background:#fff8e1;color:#d97706}
</style></head><body>
<div class="card">
  <div class="header"><h1>🌉 EthioBridge</h1><p>${title}</p></div>
  <div class="body">${body}</div>
  <div class="footer">© ${new Date().getFullYear()} EthioBridge · Ethiopia's Construction Marketplace<br>
  If you did not request this email, please ignore it or contact <a href="mailto:support@ethiobridge.et">support@ethiobridge.et</a></div>
</div></body></html>`;

// ── 1. Email Verification ──
const sendVerificationEmail = async (userEmail, token) => {
  // Link goes to backend which verifies token then redirects to frontend
  const backendUrl = BACKEND();
  const link = `${backendUrl}/api/verify-email?token=${token}`;
  
  console.log(`[EMAIL] Sending verification email to ${userEmail}`);
  console.log(`[EMAIL] Verification link: ${link}`);
  
  await transporter.sendMail({
    from: FROM(), to: userEmail,
    subject: 'Verify your EthioBridge email address',
    html: wrap('Email Verification', `
      <p>Hi there,</p>
      <p>Thanks for signing up on <strong>EthioBridge</strong>! Please verify your email address to activate your account.</p>
      <a href="${link}" class="btn">✉️ Verify Email Address</a>
      <p style="font-size:13px;color:#888">Or copy this link into your browser:<br>
      <a href="${link}" style="color:#0a5c2f;word-break:break-all">${link}</a></p>
      <p style="font-size:13px;color:#888">This link expires in <strong>24 hours</strong>.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="font-size:13px;color:#888">You signed up using this email address. If this was not you, please ignore this message or contact support.</p>
    `),
  });
  
  console.log(`[EMAIL] Verification email sent successfully to ${userEmail}`);
};

// ── 2. Signup Notification ──
const sendSignupNotification = async (userEmail) => {
  await transporter.sendMail({
    from: FROM(), to: userEmail,
    subject: 'Welcome to EthioBridge – Account Created',
    html: wrap('Account Created', `
      <p>Hi,</p>
      <p>A new account was created on <strong>EthioBridge</strong> using this email address.</p>
      <p>If this was you, no action is needed — please check your inbox for a verification email.</p>
      <p>If this was <strong>not you</strong>, please ignore this message or contact our support team immediately at
      <a href="mailto:support@ethiobridge.et">support@ethiobridge.et</a>.</p>
    `),
  });
};

// ── 3. Industry Approval ──
const sendApprovalEmail = async (userEmail, companyName) => {
  await transporter.sendMail({
    from: FROM(), to: userEmail,
    subject: '✅ Your EthioBridge Industry Account Has Been Approved',
    html: wrap('Account Approved', `
      <p>Hi <strong>${companyName}</strong>,</p>
      <p>Great news! Your industry account has been <span class="badge badge-green">✓ Approved</span> by our admin team.</p>
      <p>You can now log in and:</p>
      <ul>
        <li>Add and manage your product listings</li>
        <li>Receive purchase requests from stakeholders</li>
        <li>View analytics and performance data</li>
        <li>Communicate with buyers directly</li>
      </ul>
      <a href="${APP()}/login" class="btn">Log In Now →</a>
      <p>Welcome to Ethiopia's construction marketplace!</p>
    `),
  });
};

// ── 4. Industry / User Rejection ──
const sendRejectionEmail = async (userEmail, companyName, reason) => {
  await transporter.sendMail({
    from: FROM(), to: userEmail,
    subject: 'Update on Your EthioBridge Application',
    html: wrap('Application Update', `
      <p>Hi <strong>${companyName}</strong>,</p>
      <p>After careful review, your application has been <span class="badge badge-red">✕ Rejected</span>.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>You may update your profile and resubmit. Please ensure:</p>
      <ul>
        <li>All required fields are complete and accurate</li>
        <li>Documents are clear and valid</li>
        <li>Business registration details are correct</li>
      </ul>
      <a href="${APP()}/login" class="btn">Update Profile →</a>
      <p>For questions, contact <a href="mailto:support@ethiobridge.et">support@ethiobridge.et</a></p>
    `),
  });
};

// ── 5. Purchase Request Approved ──
const sendPurchaseApprovedEmail = async (userEmail, productName, industryName) => {
  await transporter.sendMail({
    from: FROM(), to: userEmail,
    subject: '✅ Your Purchase Request Has Been Approved',
    html: wrap('Purchase Request Approved', `
      <p>Hi,</p>
      <p>Your purchase request for <strong>${productName}</strong> from <strong>${industryName}</strong> has been
      <span class="badge badge-green">✓ Approved</span>.</p>
      <p>The industry will be in touch with you shortly to proceed with the transaction.</p>
      <a href="${APP()}/messages" class="btn">View Messages →</a>
    `),
  });
};

// ── 6. Purchase Request Rejected ──
const sendPurchaseRejectedEmail = async (userEmail, productName, industryName, reason) => {
  await transporter.sendMail({
    from: FROM(), to: userEmail,
    subject: 'Update on Your Purchase Request',
    html: wrap('Purchase Request Update', `
      <p>Hi,</p>
      <p>Your purchase request for <strong>${productName}</strong> from <strong>${industryName}</strong> has been
      <span class="badge badge-red">✕ Rejected</span>.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>You may submit a new request or contact support if you believe this is an error.</p>
      <a href="${APP()}/stakeholders" class="btn">Browse Industries →</a>
    `),
  });
};

// ── 7. Account Suspended / Banned ──
const sendSuspensionEmail = async (userEmail, action, reason) => {
  const isBan = action === 'banned';
  await transporter.sendMail({
    from: FROM(), to: userEmail,
    subject: `Important: Your EthioBridge Account Has Been ${isBan ? 'Banned' : 'Suspended'}`,
    html: wrap(`Account ${isBan ? 'Banned' : 'Suspended'}`, `
      <p>Hi,</p>
      <p>Your EthioBridge account has been <span class="badge badge-${isBan ? 'red' : 'amber'}">${isBan ? '🚫 Banned' : '⏸ Suspended'}</span>
      due to a policy violation.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>If you believe this is a mistake or would like to appeal, please contact our support team:</p>
      <a href="mailto:support@ethiobridge.et" class="btn">Contact Support</a>
      <p style="font-size:13px;color:#888">
        ${isBan ? 'Banned accounts cannot be reactivated without admin review.' : 'Suspended accounts may be reactivated after the suspension period ends.'}
      </p>
    `),
  });
};

// ── 8. Password Reset ──
const sendPasswordResetEmail = async (userEmail, token) => {
  const link = `${BACKEND()}/api/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM(), to: userEmail,
    subject: '🔑 Reset Your EthioBridge Password',
    html: wrap('Password Reset Request', `
      <p>Hi,</p>
      <p>We received a request to reset the password for your EthioBridge account.</p>
      <a href="${link}" class="btn">🔑 Reset My Password</a>
      <p style="font-size:13px;color:#888">Or copy this link into your browser:<br>
      <a href="${link}" style="color:#0a5c2f;word-break:break-all">${link}</a></p>
      <p style="font-size:13px;color:#888">This link expires in <strong>1 hour</strong>.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="font-size:13px;color:#888">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
    `),
  });
};

module.exports = {
  sendVerificationEmail,
  sendSignupNotification,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPurchaseApprovedEmail,
  sendPurchaseRejectedEmail,
  sendSuspensionEmail,
  sendPasswordResetEmail,
};
