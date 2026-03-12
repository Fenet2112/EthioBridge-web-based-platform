# Stakeholder Profile Feature Setup Guide

## ✅ Completed Steps

1. **Database Migration Created**: `database/migrations/003_add_stakeholder_profiles.sql`
   - Adds username, full_name, bio, profile_picture columns to stakeholders table

2. **Backend API Routes Created**: `backend/src/routes/profile.js`
   - GET `/api/profile/me` - Get own profile
   - PUT `/api/profile/me` - Update profile
   - POST `/api/profile/me/picture` - Upload profile picture
   - DELETE `/api/profile/me/picture` - Delete profile picture
   - GET `/api/profile/user/:username` - Public profile view

3. **Frontend Profile Page Created**: `frontend/src/pages/ProfilePage.jsx`
   - Beautiful gradient design matching the app theme
   - Edit mode for updating profile information
   - Profile picture upload with preview
   - View mode for displaying profile

4. **Navigation Link Added**:
   - Stakeholders page: "My Profile" button in header (top-right corner)

5. **Route Configuration**: Profile route already configured in `frontend/src/App.js`

---

## 🔧 Required Setup Steps

### 1. Install Backend Dependencies
```bash
cd backend
npm install multer
```

### 2. Run Database Migration
```bash
# From the project root directory
psql -U postgres -d ethiobridge -f database/migrations/003_add_stakeholder_profiles.sql
```

### 3. Restart Backend Server
After installing multer and running the migration, restart your backend server:
```bash
cd backend
# Stop the current server (Ctrl+C if running)
# Then start it again
npm start
```

### 4. Test the Feature
1. Log in as a stakeholder
2. Click the "My Profile" button in the top-right corner of the header (purple button)
3. Fill in your profile information:
   - Username (unique, required)
   - Full Name (required)
   - Bio/Description (optional)
   - Profile Picture (optional, max 5MB)
4. Click "Save Changes"
5. Your profile will be saved and displayed in view mode

**Note**: This profile feature is only available for stakeholders, not for industries.

---

## 📁 File Structure

### Backend Files
- `backend/src/routes/profile.js` - Profile API endpoints
- `backend/uploads/profiles/` - Profile pictures storage (created automatically)
- `database/migrations/003_add_stakeholder_profiles.sql` - Database schema

### Frontend Files
- `frontend/src/pages/ProfilePage.jsx` - Profile page component
- `frontend/src/pages/ProfilePage.css` - Profile page styles
- `frontend/src/pages/Stakeholders.jsx` - Updated with profile link
- `frontend/src/pages/Stakeholders.css` - Updated header styles

---

## 🎨 Features

- **Stakeholder-Only**: Profile feature is exclusively for stakeholders
- **Profile Picture Upload**: Supports JPEG, PNG, GIF (max 5MB)
- **Unique Usernames**: System validates username uniqueness
- **Edit/View Modes**: Toggle between editing and viewing profile
- **Gradient Theme**: Matches the purple gradient theme (#667eea to #764ba2)
- **Responsive Design**: Works on all screen sizes
- **Secure**: Uses JWT authentication for all profile operations

---

## 🔒 Security Notes

- Profile pictures are stored in `backend/uploads/profiles/`
- File size limited to 5MB
- Only authenticated users can access profile endpoints
- Username uniqueness is enforced at database level
- Profile pictures are served as static files

---

## 🚀 Next Steps (Optional Enhancements)

1. Add profile picture to stakeholder navbar/header
2. Show stakeholder profile in industry detail pages
3. Add profile completion percentage indicator
4. Add social media links to profiles
5. Add profile verification badges
6. Add profile view counter
7. Allow industries to view stakeholder profiles when they receive purchase requests
