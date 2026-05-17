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
mobile/
├── app/                        # expo-router file-based routes
│   ├── _layout.jsx             # Root layout (tab navigator)
│   ├── index.jsx               # Entry redirect → (tabs)
│   └── (tabs)/
│       ├── heatmap.jsx         # Signal heatmap (3 modes + report overlay)
│       ├── best.jsx            # Best network near me
│       ├── report.jsx          # Manual outage report form
│       ├── history.jsx         # Per-device submission history
│       └── settings.jsx        # Background collection toggle + stats
├── components/                 # Shared UI components
│   ├── PageHeader.jsx
│   ├── ProviderCard.jsx
│   ├── CustomPicker.jsx
│   ├── RadioButtonGroup.jsx
│   └── SignalHistoryCard.jsx
├── services/                   # Business logic / external integrations
│   ├── api.js                  # All backend API calls (fetch-based)
│   ├── sensingService.js       # Signal measurement + latency-to-dBm proxy
│   ├── backgroundCollectionService.js  # expo-task-manager wrapper
│   ├── submissionTracker.js    # Success/failure stats (AsyncStorage)
│   └── appInitService.js       # App startup initialisation
├── config/
│   └── api.js                  # API_BASE_URL, provider enums, quality levels
├── constants/
│   └── theme.js                # COLORS, FONTS, SPACING, RADIUS, SHADOWS
└── utils/
    └── helpers.js              # getDeviceId(), formatters
```

## Core Modules

### 1. sensingService.js

**Purpose**: Collect a single network telemetry packet on demand.

**How it works:**
1. Reads carrier name + network generation via `expo-cellular`
2. Gets GPS coordinates via `expo-location`
3. Runs an active latency test (HTTP ping to backend `/health`) to derive a dBm-proxy signal strength value
4. Checks `expo-network` for internet reachability (`connectivityFlag`)
5. Assembles and returns a `TelemetryPacket` ready for submission

**iOS note:** `getCarrierNameAsync()` returns null on iOS 16+ (Apple deprecated `CTCarrier`). The service substitutes `"iOS Carrier"` as a fallback.

### 2. backgroundCollectionService.js

**Purpose**: Register and manage periodic background data collection.

**Key settings:**
- `COLLECTION_INTERVAL = 10 * 60` (10 minutes, requested; iOS enforces ~15-min minimum)
- `MIN_BATTERY_LEVEL = 0.15` (skips collection below 15% unless charging)
- Registers two tasks: `background-network-collection` (BGFetch) + `background-location-collection`
- Maintains collection stats (totalCollections, failedCollections) in AsyncStorage

**iOS vs Android:**
- Android: BGFetch fires at the requested interval with reasonable reliability
- iOS: Interval is system-controlled; the OS learns app usage patterns

### 3. api.js

**Purpose**: All HTTP communication with the backend.

**Key exports:**
```javascript
submitNetworkData(data)          // POST /api/networks
getAggregatedHeatmap(filters)    // GET /api/networks/heatmap/aggregated
getHeatmapData(filters)          // GET /api/networks/heatmap
getBestNetwork(lat, lng, radius) // GET /api/networks/best
getMyHistory(deviceId)           // GET /api/networks/history
submitReport(reportData)         // POST /api/reports
getReports(filters)              // GET /api/reports
getProviderComparison()          // GET /api/analytics/provider-comparison
getBlackoutRate(start, end)      // GET /api/analytics/blackout-rate
```

All calls use the native `fetch` API. `API_BASE_URL` is defined in `config/api.js`.

### 4. submissionTracker.js

**Purpose**: Track submission success/failure counts locally (AsyncStorage). Displayed in the Settings tab as a success rate percentage.

### 5. appInitService.js

**Purpose**: Called once on app startup to register background tasks and restore settings from AsyncStorage.

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
## Navigation

The app uses **expo-router v6** with file-based routing. The `app/(tabs)/` directory maps directly to the bottom tab navigator. No manual `React.Navigation` configuration is required — routes are inferred from file names.

Key routing behaviour:
- `app/index.jsx` redirects to `(tabs)/heatmap` on load
- `useFocusEffect` (from `expo-router`) is used in screens that need to reload data when the user navigates back to a tab (e.g. heatmap reloads signal data on tab focus)

## State Management

State is managed entirely with React hooks — no Redux. Each screen owns its own `useState` / `useEffect` state. Cross-screen shared data (device ID, background settings) is persisted to AsyncStorage and loaded on mount.

## Performance Optimisations

- **Median aggregation** at geohash precision 5–6 reduces heatmap render load
- **5-minute Redis TTL** on all GET endpoints reduces repeated database hits
- **Battery gate** in background collection: collection is skipped below 15%
- Map marker rendering is scoped to the current viewport bounding box

## Build & Distribution

```bash
# Development
cd mobile
npx expo start

# Production build (EAS)
eas build --platform android --profile production
eas build --platform ios --profile production

# OTA update
eas update --branch production
```

## Related Documentation
- [System Design](system-design.md)
- [API Specification](api-specification.md)
- [Limitations](limitations.md)
