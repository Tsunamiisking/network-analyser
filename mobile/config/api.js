// API Configuration
// Update this URL based on your environment

// For iOS Simulator (use localhost)
// export const API_BASE_URL = 'http://localhost:3000/api';

// For Android Emulator (use special Android IP)
// export const API_BASE_URL = 'http://10.0.2.2:3000/api';

// For Physical Device or Expo Go (replace with your computer's actual IP)
// Run this command to find your IP: ifconfig | grep "inet " | grep -v 127.0.0.1
// macOS: System Settings > Network > Wi-Fi > Details > TCP/IP > IPv4 Address
export const API_BASE_URL = 'http://192.168.1.146:3000/api';

// Development helper: Test with localhost first if you're having connection issues
// export const API_BASE_URL = 'http://localhost:3000/api';

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
  // DBSCAN Clustering endpoints
  CLUSTERING_DEADZONES: '/clustering/deadzones',
  CLUSTERING_SIGNAL_QUALITY: '/clustering/signal-quality',
  CLUSTERING_PROVIDER: '/clustering/provider',
  CLUSTERING_ANOMALIES: '/clustering/anomalies',
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

// Signal Quality Levels for clustering
export const SIGNAL_QUALITY_LEVELS = {
  EXCELLENT: 'excellent',  // -70 to 0 dBm
  GOOD: 'good',            // -85 to -70 dBm
  FAIR: 'fair',            // -100 to -85 dBm
  POOR: 'poor',            // -110 to -100 dBm
  VERY_POOR: 'very_poor',  // < -110 dBm
};

// Default DBSCAN parameters
export const DBSCAN_DEFAULTS = {
  // Dead zones
  DEAD_ZONE_EPSILON: 800,      // 800m radius
  DEAD_ZONE_MIN_POINTS: 3,     // Min 3 points
  
  // Signal quality
  QUALITY_EPSILON: 1000,        // 1000m radius
  QUALITY_MIN_POINTS: 5,        // Min 5 points
  
  // Provider analysis
  PROVIDER_EPSILON: 800,        // 800m radius
  PROVIDER_MIN_POINTS: 5,       // Min 5 points
  
  // Anomaly detection
  ANOMALY_EPSILON: 1000,        // 1000m radius
  ANOMALY_MIN_POINTS: 5,        // Min 5 points
};
