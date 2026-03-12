# Hybrid Verification System for Purchase Requests

## Overview

The system now supports TWO different flows for purchase requests based on stakeholder account status:

### Flow 1: Approved Stakeholders (One-Time Verification)
✅ Account status: `approved`
- Simple form with only quantity and notes
- Profile data auto-filled from verified stakeholder profile
- Request goes directly to industry (status: `approved`)
- No admin approval needed for each request

### Flow 2: New/Pending Stakeholders (Per-Request Verification)
⚠️ Account status: `incomplete` or `pending`
- Full form with all details required
- Must provide: full name, organization name, phone, location, quantity, notes
- Request goes to admin for verification (status: `pending`)
- Admin must approve each request before it reaches the industry

---

## User Experience

### For Approved Stakeholders

1. Click "Buy" on any product
2. See simple modal with:
   - Quantity (required)
   - Notes (optional)
   - Blue info banner: "Your verified profile information will be sent automatically"
3. Submit
4. Success message: "Purchase request sent to industry successfully!"
5. Industry sees the request immediately

### For New/Pending Stakeholders

1. Click "Buy" on any product
2. See full form with:
   - Full Name / Contact Person (required)
   - Organization Name (required)
   - Phone Number (required)
   - Location / City (required)
   - Quantity (required)
   - Notes (optional)
   - Yellow warning banner: "Please fill in your details. This request will be sent to admin for verification."
3. Submit
4. Success message: "Purchase request submitted for admin verification!"
5. Admin reviews and approves/rejects
6. If approved, industry sees the request

---

## Backend Logic

### Endpoint: `POST /api/purchases`

**Middleware:**
- `authenticateToken` - Validates JWT token
- `requireRole("stakeholder")` - Ensures user is a stakeholder
- ~~`requireApproved`~~ - REMOVED! Now handles both approved and non-approved users

**Request Body:**

For approved users:
```json
{
  "industry_id": 1,
  "product_id": 5,
  "quantity": 10,
  "notes": "Optional notes"
}
```

For non-approved users:
```json
{
  "industry_id": 1,
  "product_id": 5,
  "quantity": 10,
  "notes": "Optional notes",
  "full_name": "John Doe",
  "organization_name": "ABC Construction",
  "phone": "+251 911 000 000",
  "location": "Addis Ababa"
}
```

**Backend Processing:**

```javascript
if (req.user.status === "approved") {
  // Fetch verified profile from database
  // Use profile data automatically
  // Set request status = 'approved'
  // Create conversation with industry
} else {
  // Use manual form data from request body
  // Validate all required fields are present
  // Set request status = 'pending'
  // Wait for admin approval
}
```

---

## Database Structure

### Purchase Requests Table

```sql
CREATE TABLE purchase_requests (
  id SERIAL PRIMARY KEY,
  stakeholder_id INTEGER REFERENCES stakeholders(id),
  industry_id INTEGER REFERENCES industries(id),
  product_id INTEGER REFERENCES products(id),
  full_name VARCHAR(255),           -- From profile OR manual input
  organization_name VARCHAR(255),   -- From profile OR manual input
  phone VARCHAR(50),                -- From profile OR manual input
  location VARCHAR(255),            -- From profile OR manual input
  quantity INTEGER NOT NULL,        -- Always from user input
  notes TEXT,                       -- Always from user input (optional)
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending' or 'approved'
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Status Values:**
- `pending` - Waiting for admin approval (for non-approved stakeholders)
- `approved` - Approved by admin OR auto-approved (for approved stakeholders)
- `rejected` - Rejected by admin

---

## Admin Dashboard

Admins see purchase requests with different indicators:

### Approved Stakeholder Requests
- Status: `approved` (auto-approved)
- Badge: Green "Verified Account"
- No action needed - already sent to industry

### Non-Approved Stakeholder Requests
- Status: `pending`
- Badge: Yellow "Needs Verification"
- Actions: Approve or Reject
- Shows all submitted details for verification

---

## Benefits of Hybrid System

### For Approved Stakeholders
✅ Fast and convenient - only 2 fields to fill
✅ No repetitive data entry
✅ Instant delivery to industry
✅ Better user experience

### For New/Pending Stakeholders
✅ Can still make purchase requests before approval
✅ Don't need to wait for profile approval
✅ Admin verifies each request individually
✅ More flexible onboarding

### For Industries
✅ Receive verified requests from approved stakeholders instantly
✅ All requests include complete contact information
✅ Can trust that approved stakeholder data is admin-verified

### For Admins
✅ Can verify stakeholders once (profile approval)
✅ Can also verify individual requests (for non-approved users)
✅ Flexibility in verification workflow
✅ Better quality control

---

## Migration from Previous System

### What Changed

**Before:**
- Only approved stakeholders could make purchase requests
- Non-approved stakeholders got 403 error
- Had to complete profile → wait for approval → then make requests

**After:**
- ALL stakeholders can make purchase requests
- Approved stakeholders: Simple form, auto-approved
- Non-approved stakeholders: Full form, needs admin approval
- More flexible and user-friendly

### Backward Compatibility

✅ Existing approved stakeholders: No change, works as before
✅ Existing purchase requests: No database changes needed
✅ Admin dashboard: Works with both types of requests

---

## Testing Checklist

### Test as Approved Stakeholder
- [ ] Log in with approved account
- [ ] Click "Buy" on a product
- [ ] See simple form (quantity + notes only)
- [ ] See blue info banner about auto-filled data
- [ ] Submit request
- [ ] See success message about sending to industry
- [ ] Verify industry receives request immediately

### Test as New Stakeholder
- [ ] Sign up new account (status: incomplete)
- [ ] Browse industries without completing profile
- [ ] Click "Buy" on a product
- [ ] See full form (name, org, phone, location, quantity, notes)
- [ ] See yellow warning banner about admin verification
- [ ] Submit request with all fields filled
- [ ] See success message about admin verification
- [ ] Verify request appears in admin dashboard as "pending"

### Test as Pending Stakeholder
- [ ] Complete profile (status changes to pending)
- [ ] Click "Buy" on a product
- [ ] See full form (same as new stakeholder)
- [ ] Submit request
- [ ] Verify request goes to admin for approval

### Test Admin Approval
- [ ] Log in as admin
- [ ] See pending purchase requests
- [ ] Approve a request
- [ ] Verify industry receives the request
- [ ] Verify conversation is created

---

## Files Modified

1. **frontend/src/pages/IndustryDetailPage.jsx**
   - Updated BuyModal to show different forms based on status
   - Added conditional form fields
   - Updated submit handler to send appropriate data
   - Updated success messages

2. **backend/src/routes/purchases.js**
   - Removed `requireApproved` middleware
   - Added logic to handle both approved and non-approved users
   - Auto-fill data for approved users
   - Use manual data for non-approved users
   - Set appropriate request status

---

## API Response Examples

### Success (Approved User)
```json
{
  "message": "Purchase request sent to industry successfully!",
  "request": {
    "id": 123,
    "status": "approved",
    "quantity": 10,
    "full_name": "John Doe",
    "organization_name": "ABC Construction",
    "phone": "+251 911 000 000",
    "location": "Addis Ababa"
  }
}
```

### Success (Non-Approved User)
```json
{
  "message": "Purchase request submitted for admin verification. You will be notified once approved.",
  "request": {
    "id": 124,
    "status": "pending",
    "quantity": 5,
    "full_name": "Jane Smith",
    "organization_name": "XYZ Developers",
    "phone": "+251 922 000 000",
    "location": "Bahir Dar"
  }
}
```

### Error (Missing Fields for Non-Approved User)
```json
{
  "message": "For non-approved accounts, full_name, organization_name, phone, and location are required."
}
```

---

## Next Steps

1. Restart backend server: `cd backend && npm start`
2. Test with both approved and non-approved accounts
3. Verify admin dashboard shows both types of requests
4. Update admin dashboard UI to distinguish between auto-approved and pending requests (optional enhancement)

---

## Future Enhancements

### Option 1: Smart Profile Pre-fill
For pending stakeholders who have completed their profile, pre-fill the form with their profile data but still send to admin for verification.

### Option 2: Automatic Approval After First Request
After admin approves the first purchase request from a non-approved stakeholder, automatically approve their account so future requests are auto-approved.

### Option 3: Request History
Show stakeholders their request history with status indicators (pending, approved, rejected).

### Option 4: Email Notifications
Send email to stakeholders when their purchase request is approved/rejected by admin.
