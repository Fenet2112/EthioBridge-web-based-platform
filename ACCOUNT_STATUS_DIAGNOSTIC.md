# Account Status Diagnostic Tool

## What I Fixed

1. **Fixed the route error**: Changed `/stakeholder-profile` to `/profile/stakeholder`
2. **Created a diagnostic page**: New page at `/account-status` to help debug status issues
3. **Improved error handling**: Better messages with options to navigate to helpful pages

## How to Use the Diagnostic Tool

### Step 1: Navigate to the Diagnostic Page
Open your browser and go to:
```
http://localhost:3000/account-status
```

### Step 2: Check Your Status
The page will show you:
- **Email**: Your account email
- **Role**: stakeholder or industry
- **Status (LocalStorage)**: What's stored in your browser
- **Status (JWT Token)**: What's in your authentication token (this is what the backend checks!)
- **Status (Database)**: The actual current status in the database

### Step 3: Follow the Instructions

The page will automatically detect your situation and show you what to do:

#### Scenario 1: Profile Incomplete
```
Status (JWT Token): incomplete
```
**What to do**: Click "Complete Profile" button to fill out your stakeholder profile

#### Scenario 2: Pending Admin Approval
```
Status (JWT Token): pending
```
**What to do**: Wait for admin to approve your account. You cannot make purchase requests yet.

#### Scenario 3: Approved but Token is Old
```
Status (Database): approved
Status (JWT Token): pending or incomplete
```
**What to do**: Click "Log Out Now" button, then log back in. This will give you a fresh JWT token with the approved status.

#### Scenario 4: Fully Approved
```
Status (JWT Token): approved
Status (Database): approved
```
**What to do**: You're all set! Click "Browse Industries" to start making purchase requests.

## Quick Fix for 403 Error

If you're getting a 403 error when trying to make a purchase request:

1. Go to: `http://localhost:3000/account-status`
2. Check what the page says
3. Follow the instructions on the page

Most likely, you need to:
- Complete your profile (if incomplete)
- Wait for admin approval (if pending)
- Log out and log back in (if approved but token is old)

## Alternative: Manual Check

You can also check your status manually:

### Check LocalStorage
1. Open browser DevTools (F12)
2. Go to Application tab → Local Storage
3. Look at the `user` key
4. Check the `status` field

### Check JWT Token
1. Copy your token from LocalStorage (key: `token`)
2. Go to https://jwt.io
3. Paste your token
4. Look at the `status` field in the payload

### Check Database
Ask the admin to run this SQL query:
```sql
SELECT email, role, status FROM users WHERE email = 'your-email@example.com';
```

## For Admins

To approve a stakeholder account:

1. Log in to admin dashboard: `http://localhost:5000/admin-dashboard`
2. Go to "Stakeholder Profiles" section
3. Find the stakeholder
4. Click "Approve"
5. Tell the stakeholder to log out and log back in

## Common Issues

### Issue: "No routes matched location /stakeholder-profile"
**Fix**: The route is `/profile/stakeholder`, not `/stakeholder-profile`. This is now fixed in the code.

### Issue: 403 error even though admin approved me
**Fix**: Your JWT token has the old status. Log out and log back in to get a fresh token.

### Issue: Status shows "approved" in LocalStorage but still getting 403
**Fix**: LocalStorage doesn't matter - the backend checks the JWT token. Log out and log back in.

## Technical Details

### Why Does This Happen?

When you log in, the backend creates a JWT token that includes your status:
```javascript
{
  id: 123,
  email: "user@example.com",
  role: "stakeholder",
  status: "pending"  // ← This is encoded in the token!
}
```

When the admin approves your account:
- ✅ Database is updated: `status = 'approved'`
- ❌ Your JWT token still has: `status = 'pending'`

The backend middleware checks the JWT token, not the database, so you get a 403 error.

### The Solution

Log out and log back in. This creates a NEW JWT token with the current status from the database:
```javascript
{
  id: 123,
  email: "user@example.com",
  role: "stakeholder",
  status: "approved"  // ← Now it's correct!
}
```

## Files Modified

1. **frontend/src/App.js**
   - Added import for AccountStatus component
   - Added route: `/account-status`

2. **frontend/src/pages/AccountStatus.jsx** (NEW)
   - Diagnostic page to check status from all sources
   - Shows clear instructions based on status
   - Provides buttons to take action

3. **frontend/src/pages/IndustryDetailPage.jsx**
   - Fixed route from `/stakeholder-profile` to `/profile/stakeholder`
   - Improved error handling with navigation options
   - Added option to go to `/account-status` page

## Next Steps

1. Make sure backend server is running: `cd backend && npm start`
2. Make sure frontend is running: `cd frontend && npm start`
3. Go to `http://localhost:3000/account-status`
4. Follow the instructions on the page
5. Try making a purchase request again

The diagnostic page will tell you exactly what's wrong and how to fix it!
