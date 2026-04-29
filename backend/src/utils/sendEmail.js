const nodemailer = require('nodemailer');

let _transporter = null;
let _verified = false;

const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,       // SSL — more reliable than 587/STARTTLS on cloud hosts
      secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      pool: true,       // reuse connections
      maxConnections: 3,
    });
  }
  return _transporter;
};

// Verify SMTP once on first send — reset on failure so next call retries
const verifyOnce = async (t) => {
  if (_verified) return;
  try {
    await t.verify();
    _verified = true;
    console.log(`[EMAIL] SMTP ready — ${process.env.EMAIL_USER}`);
  } catch (err) {
    _transporter = null; // force re-init on next attempt
    _verified = false;
    console.error('[EMAIL] SMTP verification failed:', err.message);
    console.error('[EMAIL] Make sure EMAIL_PASS is a valid 16-char Gmail App Password');
    console.error('[EMAIL] Generate one at: https://myaccount.google.com/apppasswords');
    throw err;
  }
};

const FROM    = () => `"EthioBridge" <${process.env.EMAIL_USER}>`;
const APP_URL = () => process.env.APP_URL     || 'http://localhost:3000';
const API_URL = () => process.env.BACKEND_URL || 'http://localhost:5000';

const send = async (mailOptions, label = 'email') => {
  const t = getTransporter();
  if (!t) {
    console.warn(`[EMAIL] Not configured — skipping ${label}`);
    return { skipped: true };
  }
  await verifyOnce(t);
  const info = await t.sendMail(mailOptions);
  console.log(`[EMAIL] Sent ${label} — ${info.messageId}`);
  return info;
};

// Shared HTML email wrapper
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
  If you did not request this email, ignore it or contact <a href="mailto:support@ethiobridge.et">support@ethiobridge.et</a></div>
</div></body></html>`;

const sendEmail = async (to, subject, html) => {
  if (!to || !subject) return { skipped: true };
  return send({
    from: FROM(), to, subject, html,
    text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }, `"${subject}"`);
};

const sendVerificationEmail = async (userEmail, token) => {
  const t = getTransporter();
  if (!t) return { skipped: true };
  const link = `${API_URL()}/api/verify-email?token=${token}`;
  return send({
    from: FROM(), to: userEmail,
    subject: 'Verify your EthioBridge email address',
    html: wrap('Email Verification', `
      <p>Hi there,</p>
      <p>Thanks for signing up! Click below to verify your email and activate your account.</p>
      <a href="${link}" class="btn">✉️ Verify Email Address</a>
      <p style="font-size:13px;color:#888">Link expires in <strong>24 hours</strong>.</p>
    `),
  }, 'verification email');
};

const sendSignupNotification = async (userEmail) => send({
  from: FROM(), to: userEmail,
  subject: 'Welcome to EthioBridge – Account Created',
  html: wrap('Account Created', `
    <p>A new account was created on EthioBridge using this email.</p>
    <p>If this wasn't you, contact <a href="mailto:support@ethiobridge.et">support@ethiobridge.et</a> immediately.</p>
  `),
}, 'signup notification');

const sendApprovalEmail = async (userEmail, companyName) => send({
  from: FROM(), to: userEmail,
  subject: '✅ Your EthioBridge Industry Account Has Been Approved',
  html: wrap('Account Approved', `
    <p>Hi <strong>${companyName}</strong>,</p>
    <p>Your industry account has been <span class="badge badge-green">✓ Approved</span>.</p>
    <p>You can now list products, receive purchase requests, and communicate with stakeholders.</p>
    <a href="${APP_URL()}/login" class="btn">Log In Now →</a>
  `),
}, 'approval email');

const sendRejectionEmail = async (userEmail, companyName, reason) => send({
  from: FROM(), to: userEmail,
  subject: 'Update on Your EthioBridge Application',
  html: wrap('Application Update', `
    <p>Hi <strong>${companyName}</strong>,</p>
    <p>Your application has been <span class="badge badge-red">✕ Rejected</span>.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>You can update your profile and resubmit. Contact <a href="mailto:support@ethiobridge.et">support</a> if you have questions.</p>
    <a href="${APP_URL()}/login" class="btn">Update Profile →</a>
  `),
}, 'rejection email');

const sendPurchaseApprovedEmail = async (userEmail, productName, industryName) => send({
  from: FROM(), to: userEmail,
  subject: '✅ Your Purchase Request Has Been Approved',
  html: wrap('Purchase Request Approved', `
    <p>Your request for <strong>${productName}</strong> from <strong>${industryName}</strong> has been
    <span class="badge badge-green">✓ Approved</span>.</p>
    <p>The industry will contact you shortly.</p>
    <a href="${APP_URL()}/messages" class="btn">View Messages →</a>
  `),
}, 'purchase approved email');

const sendPurchaseRejectedEmail = async (userEmail, productName, industryName, reason) => send({
  from: FROM(), to: userEmail,
  subject: 'Update on Your Purchase Request',
  html: wrap('Purchase Request Update', `
    <p>Your request for <strong>${productName}</strong> from <strong>${industryName}</strong> was
    <span class="badge badge-red">✕ Rejected</span>.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <a href="${APP_URL()}/stakeholders" class="btn">Browse Industries →</a>
  `),
}, 'purchase rejected email');

const sendSuspensionEmail = async (userEmail, action, reason) => {
  const isBan = action === 'banned';
  return send({
    from: FROM(), to: userEmail,
    subject: `Your EthioBridge Account Has Been ${isBan ? 'Banned' : 'Suspended'}`,
    html: wrap(`Account ${isBan ? 'Banned' : 'Suspended'}`, `
      <p>Your account has been <span class="badge badge-${isBan ? 'red' : 'amber'}">${isBan ? '🚫 Banned' : '⏸ Suspended'}</span>.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <a href="mailto:support@ethiobridge.et" class="btn">Contact Support</a>
    `),
  }, 'suspension email');
};

const sendPasswordResetEmail = async (userEmail, token) => {
  const link = `${API_URL()}/api/reset-password?token=${token}`;
  return send({
    from: FROM(), to: userEmail,
    subject: '🔑 Reset Your EthioBridge Password',
    html: wrap('Password Reset', `
      <p>Click below to reset your password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${link}" class="btn">🔑 Reset Password</a>
      <p style="font-size:13px;color:#888">If you didn't request this, ignore the email — your password won't change.</p>
    `),
  }, 'password reset email');
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendSignupNotification,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPurchaseApprovedEmail,
  sendPurchaseRejectedEmail,
  sendSuspensionEmail,
  sendPasswordResetEmail,
};
