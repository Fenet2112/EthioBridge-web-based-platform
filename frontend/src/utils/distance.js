/**
 * Distance calculation utilities using Haversine formula
 */

/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert latitude and longitude from degrees to radians
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  const distance = R * c; // Distance in kilometers
  
  return distance;
}

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(distance) {
  if (distance === null || distance === undefined || isNaN(distance)) {
    return 'Distance unavailable';
  }
  
  if (distance < 1) {
    // Show in meters for distances less than 1km
    return `${Math.round(distance * 1000)}m away`;
  } else {
    // Show in kilometers with 1 decimal place
    return `${distance.toFixed(1)} km away`;
  }
}

/**
 * Get user's current location using Geolocation API
 * @returns {Promise<{latitude: number, longitude: number}>} User's coordinates
 */
export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 300000 // 5 minutes cache
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'An unknown error occurred while getting location';
            break;
        }
        
        reject(new Error(errorMessage));
      },
      options
    );
  });
}

/**
 * Sort industries by distance from user location
 * @param {Array} industries - Array of industry objects
 * @param {Object} userLocation - User's location {latitude, longitude}
 * @returns {Array} Sorted array of industries with distance property
 */
export function sortIndustriesByDistance(industries, userLocation) {
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return industries.map(industry => ({ ...industry, distance: null }));
  }

  return industries
    .map(industry => {
      const distance = industry.latitude && industry.longitude
        ? calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            industry.latitude,
            industry.longitude
          )
        : null;
      
      return { ...industry, distance };
    })
    .sort((a, b) => {
      // Sort by distance (null distances go to end)
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
}

/**
 * Add distance information to industries
 * @param {Array} industries - Array of industry objects
 * @param {Object} userLocation - User's location {latitude, longitude}
 * @returns {Array} Industries with distance property added
 */
export function addDistanceToIndustries(industries, userLocation) {
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return industries.map(industry => ({ ...industry, distance: null }));
  }

  return industries.map(industry => {
    const distance = industry.latitude && industry.longitude
      ? calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          industry.latitude,
          industry.longitude
        )
      : null;
    
    return { ...industry, distance };
  });
}