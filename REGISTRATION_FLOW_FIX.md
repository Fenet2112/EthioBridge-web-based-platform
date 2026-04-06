# Registration Flow & Pending Status Fix

## 📋 Overview

This document explains how the registration and approval flow works in EthioBridge, and how to ensure newly registered industries appear in the Admin Approval section.

## 🔄 Registration Flow

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
- User account created with `status = 'incomplete'`
- Email verification token generated
- Verification email sent
- User can now log in

**Status**: `incomplete` ✅ (Correct - profile not yet filled)

### Step 2: Complete Profile
**Endpoint**: `POST /api/industry-profile`

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
- Industry profile created/updated
- User status changed to `status = 'pending'`
- User now appears in Admin Approval section

**Status**: `pending` ✅ (Ready for admin approval)

### Step 3: Admin Approval
**Admin Dashboard** → **Approval Section** → **Pending Tab**

**Admin Actions**:
- **Approve**: `status = 'approved'` → User can access full platform
- **Reject**: `status = 'rejected'` → User notified of rejection

## 🎯 Status Flow Diagram

```
Signup → incomplete
   ↓
Complete Profile → pending
   ↓
Admin Review → approved OR rejected
```

## ✅ What Was Fixed

### 1. Database Migration
**File**: `database/migrations/014_fix_pending_status.sql`

**Purpose**: Update existing users who have completed profiles but are stuck in 'incomplete' status

**What it does**:
```sql
-- For industries with completed profiles
UPDATE users SET status = 'pending'
WHERE status = 'incomplete'
  AND has completed industry profile

-- For stakeholders with completed profiles  
UPDATE users SET status = 'pending'
WHERE status = 'incomplete'
  AND has completed stakeholder profile
```

### 2. Admin Query Fix
**File**: `backend/src/routes/admin.js`

**Fixed**:
- Removed non-existent columns from queries
- Added proper error logging
- Returns only users with `status = 'pending'`

### 3. Profile Submission
**File**: `backend/src/routes/auth.js`

**Already Correct**:
```javascript
// When industry profile is submitted
await pool.query("UPDATE users SET status = 'pending' WHERE id = $1", [user_id]);
```

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
   Expected: User created with status = 'incomplete'

2. **Log In**:
   ```bash
   POST /api/login
   {
     "email": "test@industry.com",
     "password": "test123"
   }
   ```
   Expected: Login successful, get JWT token

3. **Complete Profile**:
   ```bash
   POST /api/industry-profile
   {
     "user_id": [from login response],
     "company_name": "Test Company",
     "sector": "Manufacturing",
     "location": "Addis Ababa"
   }
   ```
   Expected: Status changes to 'pending'

4. **Check Admin Panel**:
   - Go to Admin Dashboard → Approval → Pending
   - Expected: "Test Company" appears in the list

5. **Approve**:
   - Click "Approve" button
   - Expected: Status changes to 'approved'

### Test 2: Check Database

```sql
-- Check user status
SELECT id, email, role, status FROM users WHERE email = 'test@industry.com';

-- Check if profile exists
SELECT * FROM industries WHERE user_id = [user_id];

-- Check pending users
SELECT u.id, u.email, u.status, i.company_name
FROM users u
LEFT JOIN industries i ON i.user_id = u.id
WHERE u.status = 'pending';
```

## 🔍 Troubleshooting

### Issue: Industry doesn't appear in Pending section

**Possible Causes**:

1. **Profile not completed**
   ```sql
   SELECT u.id, u.email, u.status, i.company_name
   FROM users u
   LEFT JOIN industries i ON i.user_id = u.id
   WHERE u.email = 'industry@example.com';
   ```
   - If `company_name` is NULL → Profile not submitted
   - If `status` is 'incomplete' → Profile not submitted

2. **Status not updated**
   ```sql
   UPDATE users SET status = 'pending' WHERE id = [user_id];
   ```

3. **Admin query issue**
   - Check backend logs for errors
   - Verify `/api/admin/pending` endpoint works

### Issue: Status stuck at 'incomplete'

**Solution**: Run the migration
```bash
cd backend
node run-migrations.js
```

This will update all users with completed profiles to 'pending' status.

### Issue: 500 Error in Admin Panel

**Check**:
1. Backend logs for specific error
2. Database columns exist
3. Queries don't reference non-existent columns

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

### Status Meanings:
- **incomplete**: User signed up but hasn't completed profile
- **pending**: Profile completed, waiting for admin approval
- **approved**: Admin approved, full access granted
- **rejected**: Admin rejected, user notified

### Key Points:
1. Users start as 'incomplete' after signup
2. Status changes to 'pending' when profile is submitted
3. Admin sees only 'pending' users in Approval section
4. Migration fixes any users stuck in 'incomplete' with completed profiles

### Files Modified:
- ✅ `database/migrations/014_fix_pending_status.sql` (new)
- ✅ `backend/src/routes/admin.js` (fixed queries)
- ✅ `backend/src/routes/auth.js` (already correct)

---

**Status**: ✅ Fixed and Tested
**Date**: January 2025
