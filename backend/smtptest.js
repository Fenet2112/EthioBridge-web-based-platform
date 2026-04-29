
const nodemailer = require("nodemailer");

(async () => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "fenufen491@gmail.com", 
        pass: "yyso qmce fhap hadv", 
      },
    });

    const info = await transporter.sendMail({
      from: `"Node Mailer" <${process.env.EMAIL_USER}>`,
      to: "bofafir144@donumart.com", 
      subject: "Test Email",
      text: "This is a test email sent via Node.js SMTP.",
    });

    console.log("Sent:", info.messageId);
  } catch (err) {
    console.error("Error sending email:", err);
  }
})();