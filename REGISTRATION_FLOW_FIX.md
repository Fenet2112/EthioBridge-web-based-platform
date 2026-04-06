# Registration Flow & Pending Status Fix

## 📋 Overview

This document explains how the registration and approval flow works in EthioBridge, and how newly registered industries appear in the Admin Approval section immediately after signup.

## 🔄 Registration Flow (Updated)

### Step 1: Signup (Create Account)
**Endpoint**: `POST /api/signup`

```javascript
{
  email: "industry@example.com",
  password: "password123",
  role: "industry" // or "stakeholder"
}
```

**What Happens**:
- User account created with `status = 'pending'` ✅ (NEW: Changed from 'incomplete')
- Email verification token generated
- Verification email sent
- User can now log in
- **User immediately appears in Admin Approval section**

**Status**: `pending` ✅ (Ready for admin approval - even before profile completion)

### Step 2: Complete Profile (Optional)
**Endpoint**: `POST /api/profile/industry` or `POST /api/profile/stakeholder`

```javascript
{
  user_id: 1,
  company_name: "ABC Construction",
  sector: "Construction",
  location: "Addis Ababa",
  description: "...",
  phone: "+251...",
  website: "...",
  established_year: 2020
}
```

**What Happens**:
- Industry/Stakeholder profile created/updated
- User status remains `status = 'pending'`
- Profile information now visible in Admin Approval section

**Status**: `pending` ✅ (Still awaiting admin approval)

### Step 3: Admin Approval
**Admin Dashboard** → **Approval Section** → **Pending Tab**

**Admin Actions**:
- **Approve**: `status = 'approved'` → User can access full platform
- **Reject**: `status = 'rejected'` → User notified of rejection

## 🎯 Status Flow Diagram (Updated)

```
Signup → pending (appears in admin approval immediately)
   ↓
Complete Profile (optional) → pending (profile info now visible)
   ↓
Admin Review → approved OR rejected
```

## ✅ What Was Fixed

### 1. Changed Signup Status (CRITICAL UPDATE)
**File**: `backend/src/routes/auth.js`

**Change**: New users now get `status = 'pending'` immediately on signup (changed from 'incomplete')

**Before**:
```javascript
// User created with status = 'incomplete'
// Did NOT appear in admin approval until profile completed
```

**After**:
```javascript
// User created with status = 'pending'
// Appears in admin approval IMMEDIATELY after signup
```

**Impact**: All newly registered users (industries and stakeholders) now appear in the Admin Approval section right away, even before completing their profile.

### 2. Database Migration
**File**: `database/migrations/015_change_signup_to_pending.sql`

**Purpose**: Update existing users from 'incomplete' to 'pending' status

**What it does**:
```sql
-- Update all users with incomplete status
UPDATE users SET status = 'pending'
WHERE status = 'incomplete';
```

**Result**: All 7 existing users with 'incomplete' status were updated to 'pending'

### 3. Admin Query (Already Correct)
**File**: `backend/src/routes/admin.js`

**Query fetches all users with status = 'pending'**:
```javascript
SELECT * FROM users WHERE status = 'pending'
```

This query now returns:
- Users who just signed up (no profile yet)
- Users who completed their profile
- All are visible in Admin Approval section

## 🧪 Testing the Flow

### Test 1: New Industry Registration

1. **Sign Up**:
   ```bash
   POST /api/signup
   {
     "email": "test@industry.com",
     "password": "test123",
     "role": "industry"
   }
   ```
   Expected: User created with status = 'pending' ✅

2. **Check Admin Panel Immediately**:
   - Go to Admin Dashboard → Approval → Pending
   - Expected: "test@industry.com" appears in the list immediately ✅
   - Note: Profile fields (company_name, sector, etc.) will be empty

3. **Log In**:
   ```bash
   POST /api/login
   {
     "email": "test@industry.com",
     "password": "test123"
   }
   ```
   Expected: Login successful, get JWT token

4. **Complete Profile (Optional)**:
   ```bash
   POST /api/profile/industry
   {
     "user_id": [from login response],
     "company_name": "Test Company",
     "sector": "Manufacturing",
     "location": "Addis Ababa"
   }
   ```
   Expected: Profile information saved, status remains 'pending'

5. **Check Admin Panel Again**:
   - Go to Admin Dashboard → Approval → Pending
   - Expected: "Test Company" now shows with full profile information ✅

6. **Approve**:
   - Click "Approve" button
   - Expected: Status changes to 'approved'

### Test 2: Check Database

```sql
-- Check user status immediately after signup
SELECT id, email, role, status FROM users WHERE email = 'test@industry.com';
-- Expected: status = 'pending'

-- Check if profile exists
SELECT * FROM industries WHERE user_id = [user_id];
-- Expected: NULL if profile not completed, or profile data if completed

-- Check all pending users
SELECT u.id, u.email, u.status, i.company_name, s.organization_name
FROM users u
LEFT JOIN industries i ON i.user_id = u.id
LEFT JOIN stakeholders s ON s.user_id = u.id
WHERE u.status = 'pending';
-- Expected: All users with pending status, including those without profiles
```

## 🔍 Troubleshooting

### Issue: Industry doesn't appear in Pending section

**This should NOT happen anymore** - all users appear immediately after signup.

If it still doesn't appear:

1. **Check user was created**:
   ```sql
   SELECT id, email, role, status FROM users WHERE email = 'industry@example.com';
   ```
   - If user doesn't exist → Signup failed
   - If status is not 'pending' → Database issue

2. **Check admin query**:
   - Open browser console
   - Look for API call to `/api/admin/pending`
   - Check response contains the user

3. **Refresh admin panel**:
   - Click the "↻ Refresh" button
   - Or reload the page

### Issue: Profile information not showing

**This is EXPECTED** - users appear in admin approval before completing profile.

**Solution**: 
- User needs to complete their profile form
- Profile information will then appear in admin panel
- Admin can still approve/reject users without complete profiles

### Issue: Can't approve user without profile

**This should work** - admin can approve users even without complete profiles.

If approval fails:
1. Check backend logs for errors
2. Verify `/api/admin/users/:id/approve` endpoint works
3. Check database permissions

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'industry' or 'stakeholder'
  status VARCHAR(50) DEFAULT 'incomplete', -- 'incomplete', 'pending', 'approved', 'rejected'
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Industries Table
```sql
CREATE TABLE industries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  sector VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  phone VARCHAR(50),
  website VARCHAR(255),
  established_year INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Deployment

### Local Development
1. Run migrations: `node backend/run-migrations.js`
2. Restart backend
3. Test registration flow

### Production (Render)
1. Push changes to GitHub
2. Render auto-deploys backend
3. Run migrations on production:
   ```bash
   node run-migrations.js
   ```
4. Verify in admin panel

## ✨ Summary

### Status Meanings (Updated):
- **pending**: User signed up (with or without profile) - awaiting admin approval
- **approved**: Admin approved, full access granted
- **rejected**: Admin rejected, user notified
- **suspended**: Temporarily blocked by admin
- **banned**: Permanently blocked by admin

### Key Changes:
1. ✅ Users get 'pending' status immediately on signup (no more 'incomplete')
2. ✅ Users appear in Admin Approval section right after registration
3. ✅ Admin can approve/reject users even before profile completion
4. ✅ Profile completion is optional but recommended
5. ✅ All 7 existing 'incomplete' users updated to 'pending'

### Files Modified:
- ✅ `backend/src/routes/auth.js` (changed signup status to 'pending')
- ✅ `database/migrations/015_change_signup_to_pending.sql` (new migration)
- ✅ `backend/update-incomplete-users.js` (utility script)
- ✅ `REGISTRATION_FLOW_FIX.md` (updated documentation)

### Database Status:
- ✅ All users now have status = 'pending'
- ✅ No users with status = 'incomplete'
- ✅ Admin approval section shows all registered users

---

**Status**: ✅ Fixed and Deployed
**Date**: January 2025
**Change**: Signup now creates users with 'pending' status instead of 'incomplete'
