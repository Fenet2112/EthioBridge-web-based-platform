# Fix for 403 Forbidden Error on Purchase Requests

## Problem
When a stakeholder tries to submit a purchase request, they receive a **403 Forbidden** error with the message:
```
Your account must be approved by admin before accessing this feature.
```

## Root Cause
The issue occurs because of how JWT tokens work:

1. When a stakeholder first signs up, their account status is `incomplete` or `pending`
2. This status is encoded into the JWT token when they log in
3. When the admin approves their account, the database is updated to `status = 'approved'`
4. **However**, the JWT token stored in the user's browser still contains the old status
5. The backend middleware `requireApproved` checks `req.user.status` from the JWT token, not from the database
6. Since the token has the old status, the request is rejected with 403

## Solution Implemented

### 1. Status Check Endpoint (Backend)
Added a new endpoint in `backend/src/routes/profile.js`:
```javascript
GET /api/profile/stakeholder/status
```
This endpoint checks the current status directly from the database and returns it.

### 2. Smart Status Detection (Frontend)
Updated `frontend/src/pages/IndustryDetailPage.jsx` to:
- Fetch the current status from the database on page load
- Decode the JWT token to check what status it contains
- Compare database status vs JWT token status
- If database shows "approved" but JWT token has old status, show a banner

### 3. User-Friendly Banner
When the mismatch is detected, a prominent banner appears with:
- Clear message: "Your account has been approved!"
- Explanation: "Please log out and log back in to refresh your session"
- Direct "Log Out" button for convenience

### 4. Better Error Messages
Enhanced error handling in the purchase request submission to show specific messages:
- If status is `pending`: "Your account is pending admin approval"
- If status is `incomplete`: "Please complete your profile first"
- If status is `approved` in localStorage but JWT is old: "Please log out and log back in"

## How to Test the Fix

### Step 1: Restart Backend Server
```bash
cd backend
npm start
```

### Step 2: Test as Stakeholder
1. Log in as a stakeholder whose account was recently approved
2. Navigate to any industry detail page
3. You should see the approval banner at the top
4. Click the "Log Out" button in the banner
5. Log back in with the same credentials
6. Try submitting a purchase request - it should work now!

### Step 3: Verify Purchase Request Works
1. After re-login, go to an industry detail page
2. Click "Buy" on any product
3. Fill in quantity and notes
4. Submit the purchase request
5. You should see: "Purchase request sent to industry successfully!"

## Technical Details

### JWT Token Structure
```javascript
{
  id: 123,
  email: "user@example.com",
  role: "stakeholder",
  status: "pending"  // ← This is the problem - it's outdated!
}
```

### Status Check Flow
```
1. Page loads
2. Fetch status from database → "approved"
3. Decode JWT token → status: "pending"
4. Compare: "approved" !== "pending"
5. Show banner: "Please log out and log back in"
```

### Why Log Out/Log In Fixes It
When the user logs in again:
1. Backend checks database for current status
2. Creates a NEW JWT token with current status: "approved"
3. Frontend stores the new token
4. All subsequent requests use the new token with correct status
5. `requireApproved` middleware now passes ✓

## Files Modified

1. **frontend/src/pages/IndustryDetailPage.jsx**
   - Added JWT token decoding logic
   - Added status comparison logic
   - Enhanced error messages
   - Banner already existed, improved detection logic

2. **backend/src/routes/profile.js**
   - Added `GET /api/profile/stakeholder/status` endpoint
   - Returns current status from database

## Alternative Solutions (Not Implemented)

### Option 1: Check Database on Every Request
- Pros: Always accurate
- Cons: Extra database query on every request, slower performance

### Option 2: Refresh Token Automatically
- Pros: Seamless user experience
- Cons: Complex implementation, security concerns

### Option 3: Use Refresh Tokens
- Pros: Industry standard, secure
- Cons: Requires significant refactoring

## Current Solution Benefits
- Simple and effective
- No performance impact
- Clear user communication
- Minimal code changes
- Easy to understand and maintain

## Next Steps
1. User should refresh the page to see the banner
2. Click "Log Out" button
3. Log back in
4. Purchase requests will work correctly

## Prevention
To avoid this issue in the future, consider:
- Implementing automatic token refresh
- Adding token expiration (e.g., 24 hours)
- Showing status in the UI so users know when they're approved
- Sending email notifications when accounts are approved
