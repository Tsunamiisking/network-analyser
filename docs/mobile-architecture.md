# Mobile Architecture

## Overview

The mobile application is built using **React Native with Expo**, providing a cross-platform solution for iOS and Android with native capabilities for GPS and network monitoring.

## Architecture Pattern

The mobile app follows a **layered architecture**:

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (React Native Components & Screens)    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Application Layer               │
│    (Business Logic & State Management)  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Service Layer                   │
│  (API Client, Storage, Location, etc.)  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Native Layer                    │
│  (Expo APIs, Native Modules)            │
└─────────────────────────────────────────┘
```

## Project Structure

```
mobile-app/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── SignalMeter.tsx
│   │   ├── MapView.tsx
│   │   └── ProviderSelector.tsx
│   ├── screens/          # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── MapScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/         # External service integrations
│   │   ├── api.ts        # Backend API client
│   │   ├── location.ts   # GPS services
│   │   ├── network.ts    # Network info services
│   │   └── storage.ts    # Local storage
│   ├── store/            # State management
│   │   ├── slices/
│   │   │   ├── measurementSlice.ts
│   │   │   └── settingsSlice.ts
│   │   └── store.ts
│   ├── hooks/            # Custom React hooks
│   │   ├── useLocation.ts
│   │   ├── useNetworkInfo.ts
│   │   └── useMeasurement.ts
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/            # Helper functions
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   └── navigation/       # Navigation configuration
│       └── AppNavigator.tsx
├── assets/               # Images, fonts, etc.
├── app.json             # Expo configuration
├── package.json
└── tsconfig.json
```

## Core Modules

### 1. Location Service

**Purpose**: Manage GPS tracking and coordinate collection

**Key Features**:
- Background location tracking
- Accuracy filtering (reject coordinates with poor accuracy)
- Battery optimization (adjustable sampling intervals)
- Permission handling

**Implementation:**
```typescript
// services/location.ts
import * as Location from 'expo-location';

export class LocationService {
  private watchId: any = null;
  
  async startTracking(callback: (location: Location.LocationObject) => void) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }
    
    this.watchId = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000,  // 30 seconds
        distanceInterval: 50   // 50 meters
      },
      callback
    );
  }
  
  stopTracking() {
    if (this.watchId) {
      this.watchId.remove();
    }
  }
}
```

### 2. Network Info Service

**Purpose**: Collect cellular network metadata

**Key Features**:
- Signal strength detection
- Network provider identification
- Connection type (2G/3G/4G/5G)
- Network state monitoring

**Implementation:**
```typescript
// services/network.ts
import * as Network from 'expo-network';
import * as Cellular from 'expo-cellular';

export class NetworkInfoService {
  async getNetworkInfo() {
    const [networkState, carrier] = await Promise.all([
      Network.getNetworkStateAsync(),
      Cellular.getCarrierNameAsync()
    ]);
    
    return {
      provider: carrier || 'Unknown',
      connectionType: networkState.type,
      isInternetReachable: networkState.isInternetReachable
    };
  }
  
  // Note: Signal strength APIs are limited on mobile platforms
  // May require native module implementation
}
```

### 3. Measurement Service

**Purpose**: Orchestrate data collection and submission

**Key Features**:
- Periodic measurement collection
- Data validation before submission
- Offline queue management
- Batch upload optimization

**Implementation:**
```typescript
// services/measurement.ts
export class MeasurementService {
  private queue: Measurement[] = [];
  
  async collectMeasurement(): Promise<Measurement> {
    const [location, networkInfo] = await Promise.all([
      locationService.getCurrentLocation(),
      networkService.getNetworkInfo()
    ]);
    
    return {
      signalStrength: networkInfo.signalStrength,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      provider: networkInfo.provider,
      connectionType: networkInfo.connectionType,
      timestamp: new Date().toISOString(),
      deviceInfo: {
        platform: Platform.OS,
        osVersion: Platform.Version.toString()
      }
    };
  }
  
  async submitMeasurement(measurement: Measurement) {
    try {
      await apiClient.post('/measurements', measurement);
    } catch (error) {
      // Queue for later if offline
      this.queue.push(measurement);
      await this.saveQueueToStorage();
    }
  }
  
  async syncQueue() {
    if (this.queue.length > 0) {
      try {
        await apiClient.post('/measurements/batch', {
          measurements: this.queue
        });
        this.queue = [];
        await this.clearQueueStorage();
      } catch (error) {
        console.error('Queue sync failed:', error);
      }
    }
  }
}
```

### 4. API Client

**Purpose**: Handle all backend communication

**Key Features**:
- Axios-based HTTP client
- Request/response interceptors
- Error handling and retry logic
- Authentication header injection

**Implementation:**
```typescript
// services/api.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.network-analyser.com/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for API key
apiClient.interceptors.request.use(async (config) => {
  const apiKey = await storage.getApiKey();
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 429) {
      // Rate limit exceeded
      return Promise.reject(new Error('Too many requests'));
    }
    return Promise.reject(error);
  }
);
```

### 5. State Management

**Purpose**: Manage application state using Redux Toolkit

**Key Slices**:
- Measurements: Current and historical measurements
- Settings: User preferences and configuration
- Network: Connection status

**Implementation:**
```typescript
// store/slices/measurementSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const submitMeasurement = createAsyncThunk(
  'measurements/submit',
  async (measurement: Measurement) => {
    const response = await apiClient.post('/measurements', measurement);
    return response.data;
  }
);

const measurementSlice = createSlice({
  name: 'measurements',
  initialState: {
    current: null,
    history: [],
    isTracking: false,
    loading: false
  },
  reducers: {
    setCurrentMeasurement: (state, action) => {
      state.current = action.payload;
    },
    toggleTracking: (state) => {
      state.isTracking = !state.isTracking;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitMeasurement.pending, (state) => {
        state.loading = true;
      })
      .addCase(submitMeasurement.fulfilled, (state, action) => {
        state.loading = false;
        state.history.unshift(action.payload);
      });
  }
});
```

## Key Screens

### 1. Home Screen
- Current signal strength display
- Start/stop tracking button
- Recent measurement summary
- Quick provider selection

### 2. Map Screen
- Real-time location marker
- Signal strength overlay
- Nearby measurements visualization
- Offline map tiles (cached)

### 3. History Screen
- List of submitted measurements
- Sync status indicator
- Retry failed submissions
- Clear history option

### 4. Settings Screen
- Tracking interval configuration
- Battery optimization settings
- Provider selection
- Privacy settings

## Background Processing

### iOS Background Modes
- Location updates
- Background fetch for queue sync

### Android Foreground Service
- Persistent notification during tracking
- Prevents system from killing the app

**Implementation:**
```typescript
// Background task registration
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_SYNC_TASK = 'background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await measurementService.syncQueue();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
  minimumInterval: 15 * 60, // 15 minutes
  stopOnTerminate: false,
  startOnBoot: true
});
```

## Performance Optimizations

### Battery Efficiency
- Adaptive sampling based on movement
- Coalesce location updates
- Batch API requests
- Suspend tracking when stationary

### Memory Management
- Limit history storage (last 100 measurements)
- Image lazy loading
- Component memoization
- Proper cleanup of listeners

### Network Efficiency
- Compress request payloads
- Cache API responses
- Delta sync for updates
- Respect metered connections

## Error Handling

### Location Errors
- Permission denied → Show rationale
- GPS unavailable → Prompt user
- Poor accuracy → Discard measurement

### Network Errors
- Offline → Queue measurement
- Timeout → Retry with backoff
- Server error → Show user notification

### Validation Errors
- Invalid signal strength → Reject locally
- Invalid coordinates → Discard
- Missing fields → Log error

## Testing Strategy

### Unit Tests
- Service layer logic
- Utility functions
- Redux reducers

### Integration Tests
- API client with mocked responses
- Location service with mocked GPS
- Measurement collection flow

### E2E Tests
- App launch and permission flow
- Measurement submission
- Offline queue sync

## Build and Deployment

### Development Build
```bash
expo start
```

### Production Build
```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

### OTA Updates
```bash
eas update --branch production
```

## Related Documentation
- [System Design](system-design.md)
- [API Specification](api-specification.md)
- [Testing](testing.md)
