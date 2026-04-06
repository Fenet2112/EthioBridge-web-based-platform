# Gmail SMTP Email Setup for EthioBridge

## Overview
EthioBridge uses Gmail SMTP for sending email verifications, notifications, and alerts. This guide explains how to configure Gmail SMTP properly for both local development and production deployment.

## Prerequisites

1. A Gmail account (e.g., fenufen491@gmail.com)
2. 2-Step Verification enabled on the Gmail account
3. Gmail App Password generated

## Step 1: Enable 2-Step Verification

1. Go to your Google Account: https://myaccount.google.com
2. Click on "Security" in the left sidebar
3. Under "Signing in to Google", click "2-Step Verification"
4. Follow the prompts to enable 2-Step Verification
5. Verify with your phone number

## Step 2: Generate Gmail App Password

1. Go to: https://myaccount.google.com/apppasswords
2. You may need to sign in again
3. Under "Select app", choose "Mail"
4. Under "Select device", choose "Other (Custom name)"
5. Enter "EthioBridge Backend" as the name
6. Click "Generate"
7. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)
8. Remove spaces: `abcdefghijklmnop`

## Step 3: Configure Environment Variables

### Local Development (.env file)

Update `backend/.env`:

```env
# Email Configuration (Gmail SMTP)
EMAIL_USER=fenufen491@gmail.com
EMAIL_PASS=abcdefghijklmnop

# Application URLs
APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

### Production Deployment (Render.com)

1. Go to your Render dashboard
2. Select your backend service
3. Click "Environment" in the left sidebar
4. Add/Update these environment variables:

```
EMAIL_USER = fenufen491@gmail.com
EMAIL_PASS = abcdefghijklmnop
APP_URL = https://your-frontend-url.vercel.app
BACKEND_URL = https://ethiobridge-web-based-platform.onrender.com
```

5. Click "Save Changes"
6. Render will automatically redeploy with new variables

## Step 4: Test Email Sending

### Test Script

Run the test script to verify email configuration:

```bash
cd backend
node test-email.js
```

Expected output:
```
[EMAIL] ✓ Gmail SMTP connection verified successfully
[EMAIL] Using email: fenufen491@gmail.com
[EMAIL] 📧 Preparing verification email for test@example.com
[EMAIL] ✓ Verification email sent successfully to test@example.com
[EMAIL] Message ID: <...@gmail.com>
```

### Test via Signup

1. Go to your application signup page
2. Register with a real email address
3. Check your inbox (and spam folder)
4. Click the verification link

## Configuration Details

### SMTP Settings

The application uses these Gmail SMTP settings:

```javascript
{
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
}
```

### Email Types Sent

1. **Email Verification** - Sent on signup
2. **Signup Notification** - Confirmation email
3. **Approval Email** - When admin approves account
4. **Rejection Email** - When admin rejects account
5. **Purchase Approved** - When purchase request approved
6. **Purchase Rejected** - When purchase request rejected
7. **Account Suspension** - When account suspended/banned
8. **Password Reset** - When user requests password reset

## Troubleshooting

### Error: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Solution**: You're using your regular Gmail password instead of an App Password.
- Generate a new App Password (see Step 2)
- Update EMAIL_PASS with the 16-character App Password

### Error: "Connection timeout"

**Solution**: Check your network/firewall settings.
- Ensure port 587 is not blocked
- Try from a different network
- Check if your hosting provider blocks SMTP ports

### Error: "2-Step Verification required"

**Solution**: Enable 2-Step Verification on your Gmail account (see Step 1)

### Emails going to spam

**Solution**: 
- Ask recipients to mark emails as "Not Spam"
- Add your domain to SPF/DKIM records (advanced)
- Use a professional email domain instead of @gmail.com

### Emails not received at all

**Checklist**:
1. ✓ Check spam/junk folder
2. ✓ Verify EMAIL_USER is correct
3. ✓ Verify EMAIL_PASS is the App Password (not regular password)
4. ✓ Check backend logs for error messages
5. ✓ Run test-email.js to verify configuration
6. ✓ Ensure environment variables are set in production

## Security Best Practices

1. **Never commit App Passwords to Git**
   - App Passwords are in .env which is in .gitignore
   - Only set them in environment variables

2. **Rotate App Passwords periodically**
   - Generate new App Password every 6 months
   - Revoke old App Passwords

3. **Use different App Passwords for different environments**
   - One for local development
   - One for production

4. **Monitor Gmail account activity**
   - Check for suspicious login attempts
   - Review sent emails regularly

## Production Deployment Checklist

Before deploying to production:

- [ ] 2-Step Verification enabled on Gmail
- [ ] Gmail App Password generated
- [ ] EMAIL_USER set in Render environment variables
- [ ] EMAIL_PASS set in Render environment variables
- [ ] APP_URL set to production frontend URL
- [ ] BACKEND_URL set to production backend URL
- [ ] Test email sending with test-email.js
- [ ] Test signup flow with real email
- [ ] Verify emails are received (check spam)
- [ ] Check backend logs for email errors

## Support

If you continue to have issues:

1. Check backend logs in Render dashboard
2. Run test-email.js locally to isolate the issue
3. Verify all environment variables are set correctly
4. Ensure Gmail account is not locked or restricted

## Alternative: Using a Custom Domain Email

For production, consider using a professional email service:

- **Google Workspace** (business@ethiobridge.et)
- **Microsoft 365** (business@ethiobridge.et)
- **SendGrid** (transactional email service)
- **Mailgun** (transactional email service)

These provide better deliverability and professional appearance.

---

**Last Updated**: January 2025
**Status**: Gmail SMTP fully configured and working
