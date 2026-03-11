import * as Location from 'expo-location';

/**
 * Reverse geocode coordinates to human-readable address
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} Formatted location string
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const result = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (result && result.length > 0) {
      const address = result[0];
      
      // Build location string with available components
      const parts = [];
      
      if (address.street) parts.push(address.street);
      if (address.district) parts.push(address.district);
      if (address.city) parts.push(address.city);
      if (address.region && !address.city) parts.push(address.region);
      
      // Return formatted address or fallback to city/region
      if (parts.length > 0) {
        return parts.slice(0, 2).join(', '); // Return first 2 components
      }
      
      // Fallback to subregion, region
      if (address.subregion) return address.subregion;
      if (address.region) return address.region;
    }
    
    // If geocoding fails, return coordinates
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return coordinates as fallback
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
};

/**
 * Format coordinates for display
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {string} Formatted coordinate string
 */
export const formatCoordinates = (latitude, longitude) => {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};

/**
 * Cache for geocoded locations to avoid repeated API calls
 */
const geocodeCache = new Map();

/**
 * Reverse geocode with caching
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} Cached or freshly geocoded location
 */
export const reverseGeocodeWithCache = async (latitude, longitude) => {
  // Create cache key (rounded to 4 decimals for ~11m precision)
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }
  
  // Geocode and cache result
  const location = await reverseGeocode(latitude, longitude);
  geocodeCache.set(cacheKey, location);
  
  return location;
};

/**
 * Clear geocoding cache
 */
export const clearGeocodeCache = () => {
  geocodeCache.clear();
};

export default {
  reverseGeocode,
  reverseGeocodeWithCache,
  formatCoordinates,
  clearGeocodeCache,
};
