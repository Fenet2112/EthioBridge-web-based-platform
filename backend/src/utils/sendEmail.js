const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendApprovalEmail = async (userEmail, companyName) => {
  const mailOptions = {
    from: `"EthioBridge Admin" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: "Your EthioBridge Industry Profile Has Been Approved!",
    html: `
      <h2>Congratulations, ${companyName}!</h2>
      <p>Your company profile has been reviewed and <strong>approved</strong> by our admin team.</p>
      <p>You can now access all features:</p>
      <ul>
        <li>Manage product listings</li>
        <li>View analytics</li>
        <li>Communicate with stakeholders</li>
      </ul>
      <p>Log in here: <a href="${process.env.APP_URL}/login">EthioBridge Login</a></p>
      <p>Thank you for joining Ethiopia's construction marketplace!</p>
      <p>Best regards,<br>EthioBridge Team</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const sendRejectionEmail = async (userEmail, companyName, reason) => {
  const mailOptions = {
    from: `"EthioBridge Admin" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: "Update on Your EthioBridge Industry Profile",
    html: `
      <h2>Profile Review Result – ${companyName}</h2>
      <p>After careful review, your company profile has been <strong>rejected</strong>.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please update the required information and resubmit your profile:</p>
      <ul>
        <li>Check license/registration details</li>
        <li>Ensure all fields are complete</li>
        <li>Upload clear documents if needed</li>
      </ul>
      <p>Log in and edit your profile here: <a href="${process.env.APP_URL}/industry">EthioBridge Industry Dashboard</a></p>
      <p>If you have questions, contact support at support@ethiobridge.et</p>
      <p>Best regards,<br>EthioBridge Admin Team</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendApprovalEmail, sendRejectionEmail };