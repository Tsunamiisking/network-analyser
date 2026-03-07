import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-constants';

// Generate or retrieve a unique device ID
export const getDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem('deviceId');
    
    if (!deviceId) {
      // Generate a unique ID using device info and timestamp
      deviceId = `${Device.default.deviceId || 'device'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    return null;
  }
};

// Check if coordinates are within Nigeria bounds
export const isInNigeria = (latitude, longitude) => {
  return (
    latitude >= 4.0 &&
    latitude <= 14.0 &&
    longitude >= 2.6 &&
    longitude <= 15.0
  );
};

// Format signal strength for display
export const formatSignalStrength = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return `${value} dBm`;
};

// Get signal strength category
export const getSignalCategory = (signalStrength) => {
  if (signalStrength >= -70) return { label: 'Excellent', color: '#4CAF50' };
  if (signalStrength >= -85) return { label: 'Good', color: '#8BC34A' };
  if (signalStrength >= -100) return { label: 'Fair', color: '#FFC107' };
  if (signalStrength >= -110) return { label: 'Poor', color: '#FF9800' };
  return { label: 'Very Poor', color: '#F44336' };
};

// Validate RSRP value (3GPP spec)
export const isValidRSRP = (rsrp) => {
  return rsrp >= -140 && rsrp <= -44;
};

// Format timestamp
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
