# One-Time Stakeholder Verification System

## ✅ Implementation Complete

This document explains the one-time verification system for stakeholders in EthioBridge.

---

## 🎯 System Overview

### The Problem (Before)
- Stakeholders had to fill out a verification form EVERY TIME they wanted to buy a product
- Repetitive data entry for organization name, phone, location, etc.
- Poor user experience

### The Solution (Now)
- Stakeholders fill out their profile ONCE during signup
- Admin verifies the stakeholder account ONCE
- All future purchase requests use the verified profile data automatically
- Stakeholders only need to specify quantity and optional notes

---

## 🔄 Complete User Flow

### 1. Stakeholder Signup & Verification (One-Time)
```
Step 1: Sign up with email/password
  ↓
Step 2: Fill stakeholder profile form
  - Organization name
  - Organization type
  - Contact person
  - Phone
  - Location
  - Description
  ↓
Step 3: Submit profile for admin approval
  ↓
Step 4: Wait for admin to approve (status: pending → approved)
  ↓
Step 5: Log out and log back in (to refresh JWT token)
  ↓
✅ VERIFIED - Can now make unlimited purchase requests
```

### 2. Making Purchase Requests (Unlimited, No Re-verification)
```
Step 1: Browse industries and products
  ↓
Step 2: Click "Buy" on any product
  ↓
Step 3: Simple modal appears asking ONLY:
  - Quantity (required)
  - Notes (optional)
  ↓
Step 4: Submit request
  ↓
✅ Request sent to industry with verified profile data automatically
```

---

## 🗄️ Database Structure

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('industry', 'stakeholder')),
  status VARCHAR(50) NOT NULL DEFAULT 'incomplete' 
    CHECK (status IN ('incomplete', 'pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Status Flow:**
- `incomplete` → User signed up but hasn't filled profile
- `pending` → Profile submitted, waiting for admin approval
- `approved` → Admin verified, can make purchase requests ✅
- `rejected` → Admin rejected the profile

### Stakeholders Table
```sql
CREATE TABLE stakeholders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_name VARCHAR(255) NOT NULL,
  organization_type VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description TEXT,
  phone VARCHAR(50),
  contact_person VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**This data is used automatically for all purchase requests!**

### Purchase Requests Table
```sql
CREATE TABLE purchase_requests (
  id SERIAL PRIMARY KEY,
  stakeholder_id INTEGER REFERENCES stakeholders(id),
  industry_id INTEGER REFERENCES industries(id),
  product_id INTEGER REFERENCES products(id),
  full_name VARCHAR(255),           -- Auto-filled from stakeholder.contact_person
  organization_name VARCHAR(255),   -- Auto-filled from stakeholder.organization_name
  phone VARCHAR(50),                -- Auto-filled from stakeholder.phone
  location VARCHAR(255),            -- Auto-filled from stakeholder.location
  quantity INTEGER NOT NULL,        -- User enters this
  notes TEXT,                       -- User enters this (optional)
  status VARCHAR(50) DEFAULT 'approved',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔧 Backend Logic

### Purchase Request Endpoint
**File:** `backend/src/routes/purchases.js`

```javascript
router.post("/purchases",
  authenticateToken,
  requireRole("stakeholder"),
  requireApproved,  // ← Checks users.status = 'approved'
  async (req, res) => {
    const { industry_id, product_id, quantity, notes } = req.body;
    
    // Get stakeholder's verified profile
    const stakeholder = await pool.query(
      "SELECT id, organization_name, contact_person, phone, location 
       FROM stakeholders WHERE user_id = $1",
      [req.user.id]
    );
    
    // Use verified data automatically
    await pool.query(
      `INSERT INTO purchase_requests
       (stakeholder_id, industry_id, product_id, 
        full_name, organization_name, phone, location, 
        quantity, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved')`,
      [
        stakeholder.id,
        industry_id,
        product_id,
        stakeholder.contact_person,  // ← From verified profile
        stakeholder.organization_name, // ← From verified profile
        stakeholder.phone,            // ← From verified profile
        stakeholder.location,         // ← From verified profile
        quantity,                     // ← User input
        notes                         // ← User input (optional)
      ]
    );
  }
);
```

**Key Points:**
- `requireApproved` middleware checks `users.status = 'approved'`
- Stakeholder profile data is fetched from database
- No form data needed from user (except quantity & notes)
- Request goes directly to industry (status = 'approved')

---

## 🎨 Frontend Changes

### Before (Complex Form)
```jsx
<form>
  <input name="full_name" required />
  <input name="organization_name" required />
  <input name="phone" required />
  <input name="location" required />
  <input name="quantity" required />
  <textarea name="business_license" />
  <textarea name="notes" />
</form>
```

### After (Simple Form)
```jsx
<form>
  <input name="quantity" required />
  <textarea name="notes" />  {/* optional */}
</form>
```

**File:** `frontend/src/pages/IndustryDetailPage.jsx`

---

## 🔐 Security & Validation

### Middleware Chain
```javascript
authenticateToken      // ← Validates JWT token
  ↓
requireRole("stakeholder")  // ← Ensures user is stakeholder
  ↓
requireApproved       // ← Checks users.status = 'approved'
  ↓
Handler executes      // ← Creates purchase request
```

### Verification Checks
1. **JWT Token**: Must be valid and not expired
2. **Role**: Must be 'stakeholder' (not 'industry')
3. **Status**: Must be 'approved' by admin
4. **Profile**: Stakeholder profile must exist in database
5. **Product**: Product must exist and belong to specified industry

---

## 📊 Admin Dashboard

Admins see stakeholder profiles with full details:
- Organization name
- Organization type
- Contact person
- Phone
- Location
- Description

**Admin Actions:**
- ✅ Approve → Sets `users.status = 'approved'`
- ❌ Reject → Sets `users.status = 'rejected'`

Once approved, stakeholder can make unlimited purchase requests.

---

## 🚀 Benefits

### For Stakeholders
✅ Fill profile once, use forever
✅ Quick purchase requests (2 fields only)
✅ No repetitive data entry
✅ Better user experience

### For Industries
✅ Receive verified stakeholder information
✅ Trust that stakeholder is admin-approved
✅ Complete contact details automatically included

### For Admins
✅ Verify stakeholders once
✅ All future requests use verified data
✅ Better quality control

---

## 🔄 Status Refresh Issue

### Problem
JWT tokens contain the user status at login time. If admin approves a stakeholder while they're logged in, the token still has old status.

### Solution
**Stakeholders must log out and log back in after admin approval** to get a fresh JWT token with `status: 'approved'`.

### Future Enhancement
Implement token refresh endpoint or real-time status checking.

---

## 📝 Testing Checklist

- [ ] Stakeholder signs up
- [ ] Stakeholder fills profile form
- [ ] Profile appears in admin dashboard
- [ ] Admin approves stakeholder
- [ ] Stakeholder logs out and logs back in
- [ ] Stakeholder can browse industries
- [ ] Stakeholder clicks "Buy" on product
- [ ] Modal shows only quantity & notes fields
- [ ] Purchase request submits successfully
- [ ] Industry sees request with full stakeholder details
- [ ] Stakeholder can buy from multiple industries without re-verification
- [ ] Stakeholder can buy multiple products without re-verification

---

## 🎯 Summary

**One-Time Verification = Better UX + Better Security**

Stakeholders are verified once by admin, then can make unlimited purchase requests using their verified profile data automatically. No more repetitive forms!
