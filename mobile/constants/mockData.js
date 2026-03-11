/**
 * Mock Data - Matches Backend API Response Format
 * Use this for development until API integration
 */

// Sample device ID for testing
export const MOCK_DEVICE_ID = "device-test-12345";

// My Signal History - matches getMyHistory endpoint response
export const MOCK_SIGNAL_HISTORY = {
  success: true,
  count: 12,
  data: [
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j1",
      signalStrength: -68,
      provider: "MTN",
      networkType: "4G",
      location: {
        type: "Point",
        coordinates: [3.3792, 6.5244] // [longitude, latitude] - Lagos
      },
      locationName: "Victoria Island, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-12T10:30:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j2",
      signalStrength: -75,
      provider: "Airtel",
      networkType: "4G",
      location: {
        type: "Point",
        coordinates: [3.3850, 6.5200]
      },
      locationName: "Lekki Phase 1, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-12T09:45:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j3",
      signalStrength: -92,
      provider: "Glo",
      networkType: "3G",
      location: {
        type: "Point",
        coordinates: [3.3700, 6.5180]
      },
      locationName: "Yaba, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-12T08:20:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j4",
      signalStrength: -62,
      provider: "MTN",
      networkType: "5G",
      location: {
        type: "Point",
        coordinates: [3.3900, 6.5300]
      },
      locationName: "Ikoyi, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-11T18:15:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j5",
      signalStrength: -105,
      provider: "9mobile",
      networkType: "4G",
      location: {
        type: "Point",
        coordinates: [3.3600, 6.5100]
      },
      locationName: "Mushin, Lagos",
      connectivityFlag: false,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-11T16:30:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j6",
      signalStrength: -80,
      provider: "Airtel",
      networkType: "4G",
      location: {
        type: "Point",
        coordinates: [3.3750, 6.5250]
      },
      locationName: "Lagos Island, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-11T14:00:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j7",
      signalStrength: -88,
      provider: "Glo",
      networkType: "4G",
      location: {
        type: "Point",
        coordinates: [3.3820, 6.5220]
      },
      locationName: "Surulere, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-11T11:45:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j8",
      signalStrength: -70,
      provider: "MTN",
      networkType: "4G",
      location: {
        type: "Point",
        coordinates: [3.3880, 6.5280]
      },
      locationName: "Ikoyi, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-10T22:10:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0j9",
      signalStrength: -95,
      provider: "9mobile",
      networkType: "3G",
      location: {
        type: "Point",
        coordinates: [3.3650, 6.5150]
      },
      locationName: "Ebute Metta, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-10T19:30:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0k0",
      signalStrength: -73,
      provider: "Airtel",
      networkType: "4G",
      location: {
        type: "Point",
        coordinates: [3.3800, 6.5260]
      },
      locationName: "Marina, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-10T15:20:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0k1",
      signalStrength: -65,
      provider: "MTN",
      networkType: "5G",
      location: {
        type: "Point",
        coordinates: [3.3920, 6.5310]
      },
      locationName: "Banana Island, Lagos",
      connectivityFlag: true,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-10T12:00:00.000Z",
    },
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0k2",
      signalStrength: -110,
      provider: "Glo",
      networkType: "2G",
      location: {
        type: "Point",
        coordinates: [3.3550, 6.5050]
      },
      locationName: "Apapa, Lagos",
      connectivityFlag: false,
      deviceId: MOCK_DEVICE_ID,
      timestamp: "2026-03-10T08:45:00.000Z",
    },
  ],
};

// Best Network Data - matches bestAggregatedNetwork endpoint
export const MOCK_BEST_NETWORK = {
  success: true,
  data: [
    {
      provider: "MTN",
      avgSignalStrength: -72,
      sampleCount: 1250,
      coverage: "Strong",
    },
    {
      provider: "Airtel",
      avgSignalStrength: -78,
      sampleCount: 980,
      coverage: "Moderate",
    },
    {
      provider: "Glo",
      avgSignalStrength: -89,
      sampleCount: 650,
      coverage: "Weak",
    },
    {
      provider: "9mobile",
      avgSignalStrength: -95,
      sampleCount: 420,
      coverage: "Weak",
    },
  ],
};

// Heatmap Data - matches getHeatmapData endpoint
export const MOCK_HEATMAP_DATA = {
  success: true,
  message: "Network data retrieved successfully",
  count: 50,
  data: [
    // Sample points for map visualization
    {
      _id: "65f1a2b3c4d5e6f7g8h9i0m1",
      signalStrength: -68,
      provider: "MTN",
      networkType: "4G",
      location: {
        type: "Point",
        coordinates: [3.3792, 6.5244]
      },
      timestamp: "2026-03-12T10:30:00.000Z",
    },
    // Add more points as needed for testing
  ],
};

export default {
  MOCK_DEVICE_ID,
  MOCK_SIGNAL_HISTORY,
  MOCK_BEST_NETWORK,
  MOCK_HEATMAP_DATA,
};
