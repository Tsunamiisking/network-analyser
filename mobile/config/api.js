// API Configuration
// Update this URL based on your environment

// For iOS Simulator
// export const API_BASE_URL = 'http://localhost:3000/api';

// For Android Emulator
// export const API_BASE_URL = 'http://10.0.2.2:3000/api';

// For Physical Device (replace with your computer's IP)
// export const API_BASE_URL = 'http://192.168.1.100:3000/api';

// For Expo Go (replace with your computer's IP)
export const API_BASE_URL = 'http://192.168.1.100:3000/api';

// Endpoints
export const ENDPOINTS = {
  NETWORKS: '/networks',
  HEATMAP: '/networks/heatmap',
  HEATMAP_AGGREGATED: '/networks/heatmap/aggregated',
  BEST_NETWORK: '/networks/best',
  DEAD_ZONES: '/networks/deadzones',
  MY_HISTORY: '/networks/history',
  REPORTS: '/reports',
  PROVIDER_COMPARISON: '/analytics/provider-comparison',
  BLACKOUT_RATE: '/analytics/blackout-rate',
};

// Nigerian Mobile Providers
export const PROVIDERS = ['MTN', 'Airtel', 'Glo', '9mobile'];

// Network Types
export const NETWORK_TYPES = ['2G', '3G', '4G', '5G'];

// Nigeria Bounding Box (for geo-fencing)
export const NIGERIA_BOUNDS = {
  minLat: 4.0,
  maxLat: 14.0,
  minLng: 2.6,
  maxLng: 15.0,
};
