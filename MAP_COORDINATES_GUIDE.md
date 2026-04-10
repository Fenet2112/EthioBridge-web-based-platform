# Map Coordinates Guide

## Overview
The interactive map feature now supports real GPS coordinates for industries. Industries can add their latitude and longitude when creating or editing their profiles.

## Database Changes
- Added `latitude` (DECIMAL 10,8) column to `industries` table
- Added `longitude` (DECIMAL 11,8) column to `industries` table
- Added index for faster geospatial queries

## How to Add Coordinates

### For Industries (via UI)
1. Log in to your industry account
2. Go to "Manage Profile" section
3. Scroll to the "Latitude" and "Longitude" fields
4. Enter your coordinates:
   - **Latitude**: e.g., 9.0320 (for Addis Ababa)
   - **Longitude**: e.g., 38.7469 (for Addis Ababa)
5. Save your profile

### Finding Your Coordinates
You can find your location's coordinates using:
1. **Google Maps**: Right-click on your location → Click the coordinates to copy
2. **GPS Device**: Use any GPS-enabled device
3. **Online Tools**: Use websites like latlong.net

### Major Ethiopian Cities Coordinates
- **Addis Ababa**: 9.0320, 38.7469
- **Dire Dawa**: 9.5930, 41.8660
- **Mekelle**: 13.4967, 39.4753
- **Gondar**: 12.6000, 37.4667
- **Bahir Dar**: 11.5933, 37.3905
- **Hawassa**: 7.0500, 38.4667
- **Adama (Nazret)**: 8.5400, 39.2700
- **Jimma**: 7.6667, 36.8333

## For Administrators

### Manual Database Update
If you need to update coordinates directly in the database:

```sql
-- Update a single industry
UPDATE industries 
SET latitude = 9.0320, longitude = 38.7469 
WHERE id = 1;

-- Update multiple industries
UPDATE industries 
SET 
  latitude = CASE 
    WHEN location ILIKE '%addis%' THEN 9.0320
    WHEN location ILIKE '%dire%' THEN 9.5930
    WHEN location ILIKE '%mekelle%' THEN 13.4967
    ELSE NULL
  END,
  longitude = CASE 
    WHEN location ILIKE '%addis%' THEN 38.7469
    WHEN location ILIKE '%dire%' THEN 41.8660
    WHEN location ILIKE '%mekelle%' THEN 39.4753
    ELSE NULL
  END
WHERE latitude IS NULL;
```

### Running the Migration
The migration has been applied locally. For production (Render):
1. The migration will run automatically on next deployment
2. Or run manually: `node backend/add-coordinates.js`

## How It Works

### Frontend
- **IndustryProfile.jsx**: New industries can add coordinates during signup
- **Industry.jsx**: Existing industries can add/update coordinates in profile section
- **Explore.jsx**: Map displays industries using real coordinates when available, falls back to mock coordinates if not set

### Backend
- **auth.js**: `/api/profile/industry` endpoint accepts latitude/longitude
- **industries.js**: `/api/industries/explore` endpoint returns coordinates
- Database stores coordinates as DECIMAL for precision

### Map Display
- Industries with coordinates: Displayed at exact location
- Industries without coordinates: Displayed at random location around Ethiopia (mock)
- Green markers indicate industry locations
- Click marker to see industry details and "View Products" button

## Benefits
1. **Accurate Location**: Industries appear at their actual location
2. **Better Discovery**: Stakeholders can find nearby industries
3. **Professional**: Real coordinates make the platform more credible
4. **Future Features**: Enables distance-based search, routing, etc.

## Next Steps
1. Encourage existing industries to add their coordinates
2. Consider making coordinates required for new signups
3. Add geocoding API to auto-fill coordinates from address
4. Add distance-based filtering on the map
5. Add marker clustering for better performance with many industries

## Technical Details
- Coordinate precision: 6 decimal places (~0.11 meters accuracy)
- Valid latitude range: -90 to 90
- Valid longitude range: -180 to 180
- Ethiopia approximate bounds: Lat 3-15, Long 33-48
