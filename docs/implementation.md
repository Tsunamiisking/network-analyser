# Network Analyser — Full Implementation Documentation

> **Purpose:** This document provides a comprehensive technical explanation of the Network Analyser system, covering architecture, implementation decisions, data flow, and known limitations. It is intended to support an academic project defence.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Mobile Application](#3-mobile-application)
4. [Backend API Server](#4-backend-api-server)
5. [Database Design](#5-database-design)
6. [Admin Dashboard (Web App)](#6-admin-dashboard-web-app)
7. [API Endpoint Reference](#7-api-endpoint-reference)
8. [Data Flow](#8-data-flow)
9. [Key Design Decisions](#9-key-design-decisions)
10. [Signal Strength Measurement & Proxy Method](#10-signal-strength-measurement--proxy-method)
11. [Spatial Indexing & Geohash](#11-spatial-indexing--geohash)
12. [Clustering & Dead Zone Detection](#12-clustering--dead-zone-detection)
13. [Caching Strategy](#13-caching-strategy)
14. [Known Limitations](#14-known-limitations)

---

## 1. Project Overview

**Network Analyser** is a crowdsourced mobile network quality monitoring system scoped to Nigeria. It collects signal quality data passively from users' smartphones, stores it in a central database, and surfaces it through an admin dashboard for analysis and reporting.

### Goals

- Map mobile network coverage quality across Nigerian carriers (MTN, Airtel, Glo, 9mobile) at a granular geographic level.
- Identify dead zones — areas with persistent connectivity failure.
- Allow manual participatory reporting of specific issues (dropped calls, slow data, etc.).
- Provide actionable analytics to compare carrier performance across regions and time periods.

### Components

| Component | Technology | Purpose |
|---|---|---|
| Mobile App | Expo (React Native) | Data collection & participatory reporting |
| Backend API | Node.js / Express v5 | REST API, data ingestion, analytics |
| Database | MongoDB Atlas | Persistent data storage |
| Cache | Redis | Heatmap query acceleration |
| Admin Dashboard | React (Vite) | Visualization & reporting UI |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Mobile App                          │
│   (Expo SDK 54 · expo-router · React Native)            │
│                                                          │
│  ┌───────────────┐   ┌──────────────────────────────┐   │
│  │ Sensing Engine│   │  Participatory Report Form   │   │
│  │  (passive)    │   │  (active, user-triggered)    │   │
│  └───────┬───────┘   └──────────────┬───────────────┘   │
│          │                          │                    │
│          └──────────── POST /api ───┘                    │
└──────────────────────────────────────────────────────────┘
                          │
                   HTTP/REST (JSON)
                          │
┌─────────────────────────▼────────────────────────────────┐
│                   Backend API Server                      │
│         (Node.js · Express v5 · Port 3000)               │
│                                                          │
│  /api/networks   /api/analytics   /api/reports           │
│  /api/clustering                                         │
│                                                          │
│  ┌──────────────┐   ┌──────────────────────────────────┐ │
│  │  Validation  │   │  Aggregation Pipelines (MongoDB) │ │
│  │  (bounding   │   │  Provider comparison, blackout   │ │
│  │   box, range)│   │  rate, heatmap, clustering       │ │
│  └──────┬───────┘   └──────────────────────────────────┘ │
│         │                                                 │
│  ┌──────▼───────┐   ┌───────────────┐                    │
│  │  MongoDB     │   │  Redis Cache  │                    │
│  │  Atlas       │   │  (5-min TTL)  │                    │
│  └──────────────┘   └───────────────┘                    │
└──────────────────────────────────────────────────────────┘
                          │
                   HTTP/REST (JSON)
                          │
┌─────────────────────────▼────────────────────────────────┐
│                   Admin Dashboard                         │
│         (Vite · React 19 · Recharts · Tailwind)          │
│                                                          │
│  Overview  │  Reports  │  Analytics                      │
└──────────────────────────────────────────────────────────┘
```

The three components are **decoupled**: the mobile app and the admin dashboard both speak to the backend independently over HTTP/REST. No direct database access from the client side.

---

## 3. Mobile Application

### Technology Stack

| Item | Detail |
|---|---|
| Framework | Expo SDK 54 (managed workflow) |
| Language | JavaScript (JSX) |
| Navigation | expo-router v6 (file-based routing) |
| Maps | react-native-maps with `PROVIDER_GOOGLE` |
| Storage | AsyncStorage (local settings + offline queue) |
| HTTP | Native `fetch` |
| State | React `useState` / `useEffect` (no Redux) |

### Sensing Pipeline (`sensingService.js`)

The sensing service is the core data collection engine. It runs on a 5-minute periodic cycle (with an emergency 1-minute cycle triggered on sudden signal drops ≥10 dBm).

**Steps in each collection cycle:**

1. **Request location** (`expo-location`) — gets GPS coordinates (lat/lng/accuracy).
2. **Measure latency** — pings the backend `/health` endpoint and records round-trip time in milliseconds.
3. **Derive signal strength proxy** — maps latency to a dBm-equivalent value (see §10).
4. **Read cellular metadata** (`expo-cellular`) — gets carrier name and network generation (2G/3G/4G/5G).
5. **Check connectivity flag** (`expo-network`) — sets `connectivityFlag = false` if latency times out (indicating a blackout sample).
6. **Assemble telemetry packet** — combines all fields into a JSON object matching the `NetworkData` schema.
7. **Submit to backend** or **queue offline** — if the device has no connectivity, the packet is stored in AsyncStorage's `offlineQueue` for later replay.

```javascript
// Latency → dBm proxy mapping
if (latencyMs === null)   return -130;  // timeout / no connection
if (latencyMs < 50)       return -55;   // Excellent
if (latencyMs < 100)      return -70;   // Good
if (latencyMs < 200)      return -85;   // Fair
if (latencyMs < 400)      return -100;  // Poor
return -115;                            // Very poor
```

### Background Collection (`backgroundCollectionService.js`)

Background data collection is managed via `expo-task-manager` and `expo-background-fetch`.

- **Interval:** 10 minutes (configurable constant).
- **iOS minimum:** The operating system enforces a minimum interval of approximately 15 minutes, regardless of the requested 10-minute setting — this is an iOS BGFetch system constraint.
- **Battery guard:** Collection is skipped if battery level drops below 15% (unless the device is charging).
- **User control:** The user can enable or disable background collection through app settings, stored in AsyncStorage.
- **Statistics tracking:** Every collection attempt (success or failure) is recorded via `submissionTracker.js` to provide the user with visibility into how much data their device has contributed.

### Participatory Reporting

Users can manually submit a structured report when they experience a network issue. The report form captures:

- **Provider** (MTN / Airtel / Glo / 9mobile)
- **Issue type** (No Signal / Slow Internet / Call Drop / No Data)
- **Free-text description**
- **GPS location** (auto-filled)
- **Occurred at** timestamp (optional — the time the issue actually happened, which may differ from submission time)

The `occurredAt` field enables the admin dashboard to compute a *reporting lag* — the delay between when an issue occurred and when it was submitted. Lags > 5 minutes are highlighted in the Reports table.

### Submission Tracker (`submissionTracker.js`)

Provides unified statistics across both passive and participatory submissions:

- `totalSubmissions`, `failedSubmissions`
- `backgroundSubmissions`, `manualSubmissions`
- `lastSubmissionTime`

All values are persisted to AsyncStorage so they survive app restarts.

---

## 4. Backend API Server

### Technology Stack

| Item | Detail |
|---|---|
| Runtime | Node.js |
| Framework | Express v5 |
| Port | 3000 |
| Database client | Mongoose (MongoDB ODM) |
| Cache client | `redis` (Node.js client) |
| Geohash | `ngeohash` |
| Clustering | `density-clustering` (DBSCAN) |
| Logging | `morgan` (HTTP access log) |
| Environment | `dotenv` |

### Server Setup (`server.js`)

```
Express app
  ├── Middleware: cors, morgan, express.json()
  ├── Custom request logger (method, URL, body summary)
  ├── GET  /health            → 200 OK (used by mobile for latency test)
  ├── /api/networks           → networkRoutes.js
  ├── /api/analytics          → analyticsRoute.js
  ├── /api/reports            → (report CRUD)
  └── /api/clustering         → (DBSCAN clustering)
```

### Input Validation (`createNetworkData`)

Every inbound `POST /api/networks` is validated before database insertion:

1. **Required fields check** — `provider`, `signalStrength`, `networkType`, `location` must all be present.
2. **Nigeria bounding box** — latitude must be in [4.0, 14.0], longitude in [2.6, 15.0]. Points outside Nigeria are rejected with HTTP 400.
3. **RSRP range check** — `signalStrength` must be in [−140, −44] dBm (3GPP standard RSRP range). Values outside this range are rejected.
4. **Geohash computation** — `ngeohash.encode(lat, lng, 6)` generates a precision-6 geohash (~1.2 km cell) stored on the document for spatial grouping.

---

## 5. Database Design

### Collection: `networkdatas`

Stores one document per sensing cycle per device. This is the primary data collection.

| Field | Type | Description |
|---|---|---|
| `provider` | String | Carrier name (MTN / Airtel / Glo / 9mobile) |
| `signalStrength` | Number | dBm-equivalent value (−130 to −44) |
| `networkType` | String | Generation: 2G / 3G / 4G / 5G |
| `location` | GeoJSON Point | `{ type: "Point", coordinates: [lng, lat] }` |
| `locationName` | String | Optional human-readable place name |
| `geohash` | String | 6-character geohash of the location |
| `rsrp` | Number | Raw RSRP if available (Android bare workflow only; null otherwise) |
| `rsrq` | Number | Raw RSRQ if available (Android bare workflow only; null otherwise) |
| `connectivityFlag` | Boolean | `false` = blackout sample (no connectivity at time of reading) |
| `deviceId` | String | Anonymous device identifier |
| `timestamp` | Date | Time of measurement |

**Indexes:**

| Index | Type | Purpose |
|---|---|---|
| `location` | 2dsphere | Geospatial queries (`$geoNear`, `$geoWithin`) |
| `geohash` | Single-field | Fast geohash-based grouping |
| `deviceId + timestamp` | Compound | Per-device history queries |
| `connectivityFlag` | Single-field | Efficient blackout filtering |
| `provider + geohash + timestamp` | Compound | Carrier-specific heatmap queries with time filters |

### Collection: `reports`

Stores one document per participatory report submitted by a user.

| Field | Type | Description |
|---|---|---|
| `provider` | String (enum) | MTN / Airtel / Glo / 9mobile |
| `issueType` | String (enum) | No Signal / Slow Internet / Call Drop / No Data |
| `description` | String | Free-text description from user |
| `location` | GeoJSON Point | GPS coordinates at time of report |
| `timestamp` | Date | Time the report was submitted |
| `occurredAt` | Date (optional) | Time the issue actually occurred |

**Indexes:**

| Index | Type | Purpose |
|---|---|---|
| `location` | 2dsphere | Spatial report queries |
| `provider + timestamp` | Compound | Filtered report listing |

### GeoJSON Format

All location fields use the GeoJSON `Point` format with **longitude first, latitude second** (GeoJSON standard, opposite of typical lat/lng convention):

```json
{
  "type": "Point",
  "coordinates": [3.3792, 6.5244]
}
```

This format is required for MongoDB's 2dsphere index and all `$geoNear` / `$geoWithin` operators to function correctly.

---

## 6. Admin Dashboard (Web App)

### Technology Stack

| Item | Detail |
|---|---|
| Build tool | Vite v8 |
| UI library | React 19.2 |
| Language | JavaScript (plain JSX, no TypeScript) |
| Routing | react-router-dom v6 |
| Charts | Recharts |
| Icons | lucide-react |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| HTTP | Native `fetch` via `apiFetch()` wrapper |
| State | React `useState` + `useEffect` (no Redux) |
| Utility | `clsx` + `tailwind-merge` via `cn()` helper |

### Page Structure

```
/             → Overview.jsx   (dashboard home)
/reports      → Reports.jsx    (manual reports table)
/analytics    → Analytics.jsx  (performance analysis)
```

All pages are nested under `Layout.jsx`, which provides the persistent sidebar navigation.

### Overview Page

Displays a real-time summary of the system state:

- **4 stat cards:** Total samples collected, active providers, reports filed, and estimated dead zones.
- **Provider signal chart (BarChart):** Average signal strength per carrier. Uses a `signalScore = dBm + 130` transformation to render positive bar heights (see §10 for why).
- **Blackout rate bars:** Horizontal bar chart showing the percentage of samples with `connectivityFlag = false` per provider.
- **Sample distribution:** Categorizes all samples into signal quality tiers (Excellent / Good / Fair / Poor / Very Poor) with a colour-coded badge.
- **Recent reports list:** Shows the 8 most recent manual reports sorted by submission time, with time-ago labels.
- **Auto-refresh:** The page re-fetches all data every 60 seconds using `setInterval`.

### Reports Page

A filterable, paginated table of all participatory reports:

- **Server-side filter:** Provider dropdown sends `?provider=MTN` to the backend.
- **Client-side filters:** Issue type and free-text search are applied in the browser to avoid extra round-trips.
- **Pagination:** 20 rows per page with previous/next controls.
- **Lag detection:** If `occurredAt` is present and more than 5 minutes before `timestamp`, a lag badge ("Xm lag" or "Xh lag") is shown on the row, indicating delayed reporting.

### Analytics Page

Three rows of charts for deeper performance analysis:

| Row | Left Chart | Right Chart |
|---|---|---|
| 1 | Average Signal Strength (BarChart) | Sample Count per provider (BarChart) |
| 2 | Blackout Rate (horizontal BarChart) | Coverage Quality distribution (PieChart) |
| 3 | Signal Quality Score (RadarChart) | Provider summary table |

- **Date range filter:** All / Last 30 days / Last 7 days — changes the `startDate`/`endDate` query parameters sent to the backend.
- **Signal Quality Score formula:** `score = Math.round(Math.max(0, Math.min(100, ((dBm + 130) / 75) * 100)))` — normalises dBm on a 0–100 scale for the radar chart.
- **Coverage Quality PieChart:** Built from aggregated heatmap cells. Each cell's `medianSignalStrength` is categorised into a quality tier, and the pie shows the proportion of geographic cells in each tier.

### Responsive Layout

The sidebar uses a CSS transform slide pattern for mobile:

- On mobile (`< md` breakpoint): sidebar is `fixed` and `z-30`, translated off-screen by default (`-translate-x-full`) and slides in when the hamburger button is pressed (`translate-x-0`).
- A semi-transparent overlay (`bg-black/40`) closes the sidebar when tapped.
- On desktop (`md` and above): sidebar is `static` (in normal document flow) with no transform.
- Each navigation link calls `onClose()` on click to automatically dismiss the mobile drawer.

### Signal Chart Fix

Recharts renders bar charts with `baseValue = 0` by default. Because all dBm signal values are **negative** (e.g., −75 to −85), bars pointing downward rendered everything inverted. The fix:

```javascript
// Transform data before passing to Recharts
const chartProviders = providers.map(p => ({
  ...p,
  signalScore: p.averageSignal + 130   // e.g., -85 → 45 (positive)
}));

// Y-axis shows real dBm labels
tickFormatter={(v) => `${v - 130} dBm`}

// Tooltip also shows real dBm
formatter={(v) => `${(v - 130).toFixed(1)} dBm`}
```

This keeps the visual correct (taller bar = stronger signal) while displaying accurate dBm values.

---

## 7. API Endpoint Reference

### Network Data Endpoints (`/api/networks`)

| Method | Path | Query Params | Description |
|---|---|---|---|
| `POST` | `/api/networks` | — | Submit a new network telemetry reading |
| `GET` | `/api/networks/heatmap` | `provider`, `startDate`, `endDate`, `minLat`, `maxLat`, `minLng`, `maxLng` | Raw heatmap data (up to 5,000 docs) |
| `GET` | `/api/networks/heatmap/aggregated` | `provider`, `startDate`, `endDate`, `precision` (4–6), bbox params | Geohash-grouped heatmap with median signal per cell |
| `GET` | `/api/networks/best` | `lat`, `lng`, `radius` (default 2000m) | Best carrier within radius of a point |
| `GET` | `/api/networks/deadzones` | `minLat`, `maxLat`, `minLng`, `maxLng` | Areas with persistent connectivity failure |
| `GET` | `/api/networks/history` | `deviceId`, `limit` | Submission history for a specific device |

### Analytics Endpoints (`/api/analytics`)

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/api/analytics/provider-comparison` | — | Average signal strength and sample count per carrier |
| `GET` | `/api/analytics/blackout-rate` | `startDate`, `endDate` | Blackout percentage and average signal per carrier |

### Report Endpoints (`/api/reports`)

| Method | Path | Query Params | Description |
|---|---|---|---|
| `POST` | `/api/reports` | — | Submit a participatory issue report |
| `GET` | `/api/reports` | `provider`, `limit`, `skip` | List reports with optional provider filter |

### Health Check

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "OK" }` — used by mobile app for latency measurement |

### POST `/api/networks` Request Body

```json
{
  "provider": "MTN",
  "signalStrength": -85,
  "networkType": "4G",
  "location": {
    "type": "Point",
    "coordinates": [3.3792, 6.5244]
  },
  "locationName": "Lagos Island",
  "geohash": "s17bc4",
  "connectivityFlag": true,
  "deviceId": "anon-device-id-abc123",
  "rsrp": null,
  "rsrq": null
}
```

### POST `/api/reports` Request Body

```json
{
  "provider": "Airtel",
  "issueType": "Call Drop",
  "description": "Call dropped three times during a 10-minute conversation",
  "location": {
    "type": "Point",
    "coordinates": [3.3792, 6.5244]
  },
  "occurredAt": "2025-01-15T14:30:00.000Z"
}
```

---

## 8. Data Flow

### Passive Sensing Flow

```
Mobile Device
    │
    │ 1. GPS fix (expo-location)
    │ 2. Ping /health → measure latency
    │ 3. latency → signalStrength proxy
    │ 4. Read carrier/network type (expo-cellular)
    │ 5. Check connectivity (expo-network)
    │
    │  POST /api/networks  (JSON)
    ▼
Backend — createNetworkData()
    │
    │ Validate: required fields, Nigeria bbox, RSRP range
    │ Compute: ngeohash.encode(lat, lng, 6) → geohash
    │
    ▼
MongoDB Atlas — networkdatas collection
    │
    │ (Later, on admin dashboard request)
    ▼
Backend — aggregation pipeline
    │
    │ GET /api/analytics/provider-comparison
    │   $addFields: _providerKey = $toLower(provider)
    │   $group:     by _providerKey → avg signal, count
    │   $project:   canonical name via $switch
    │
    ▼
Admin Dashboard — Overview / Analytics pages
    │
    │ Transform: signalScore = dBm + 130 (for Recharts)
    │ Display:   BarChart, PieChart, RadarChart
    ▼
```

### Participatory Report Flow

```
User fills report form (provider, issue type, description)
    │
    │  POST /api/reports  (JSON)
    ▼
Backend — validates and stores to `reports` collection
    │
    │  GET /api/reports?provider=MTN
    ▼
Admin Dashboard — Reports page
    │
    │ Client-side filter: issueType, text search
    │ Lag detection: |timestamp - occurredAt| > 5 min → show lag badge
    ▼
```

### Heatmap Aggregation Flow

```
Admin Dashboard requests aggregated heatmap
    │
    │  GET /api/networks/heatmap/aggregated?precision=5
    ▼
Backend — getAggregatedHeatmapData()
    │
    │ Check Redis cache (key = hash of query params + precision)
    │   HIT  → return cached JSON, cached: true
    │   MISS → run MongoDB aggregation pipeline:
    │
    │   $match   → filter by provider / date range / bounding box
    │   $group   → group by geohash prefix (substr 0..precision)
    │              collect all signalStrengths[], min, max, count
    │   $project → compute signalVariance
    │   $sort    → by count desc
    │
    │ JavaScript median calculation (more reliable than MongoDB)
    │ ngeohash.decode(geohash) → lat/lng centre of cell
    │
    │ Save result to Redis (TTL = 5 minutes)
    ▼
Dashboard — Coverage Quality PieChart
    │
    │ buildQualityDist(cells): categorise medianSignalStrength into tiers
    ▼
```

---

## 9. Key Design Decisions

### 1. Crowdsourced / Participatory Sensing Model

The system uses smartphones as distributed sensors. This avoids the need for dedicated hardware deployment while achieving broad geographic coverage. The trade-off is data quality variability — a smartphone's signal reading is an approximation, not a calibrated instrument measurement.

### 2. No Authentication (Research Prototype)

The backend has no authentication layer. This was an intentional decision for a research prototype where ease of data collection outweighs access control. Any production deployment would require at minimum API key validation for write endpoints (`POST /api/networks`, `POST /api/reports`).

### 3. Median Aggregation for Heatmap Cells

When grouping measurements by geohash cell, the system uses **median** rather than mean signal strength. This provides robustness against outliers — a single erroneous reading (e.g., a device with a hardware fault reporting −130 dBm) does not skew the cell's reported signal. The median is computed in JavaScript after the MongoDB aggregation pipeline collects all values, because MongoDB's native median computation (`$percentile`) has limited availability across Atlas tiers.

### 4. Geohash for Spatial Grouping

Geohash encodes a geographic coordinate into a short string where nearby locations share a common prefix. Precision 6 produces cells of approximately 1.2 km × 0.6 km, which balances granularity against data density (too-small cells would have too few samples to be statistically meaningful at early deployment). The precision parameter is configurable (4–6) to support different zoom levels.

### 5. Redis Caching for Heatmap Queries

Heatmap aggregation is the most computationally expensive operation in the system — it processes thousands of documents through a multi-stage MongoDB pipeline. Redis caching with a 5-minute TTL means repeated requests from the dashboard hit memory rather than the database. The cache key is derived from all query parameters so different filter combinations each get their own cached result.

### 6. `connectivityFlag` to Avoid Survivorship Bias

A critical design choice: the system records samples even when the device has **no connectivity** (`connectivityFlag = false`, `signalStrength = −130`). Without this, the dataset would only contain measurements from moments when the phone successfully reached the server — systematically excluding blackouts and creating a survivorship bias that would make coverage appear better than it actually is. The offline queue in AsyncStorage defers failed submissions for later replay, capturing these blackout measurements once connectivity is restored.

### 7. Provider Name Normalisation

During early testing, data was submitted with lowercase provider names (`mtn`, `airtel`, `glo`) while production submissions used proper case (`MTN`, `Airtel`, `Glo`). MongoDB's `$group` is case-sensitive, so the analytics pipeline initially returned 7 groups instead of 4. The fix — applied to both `providerComparison` and `blackoutRate` pipelines — uses `$addFields` with `$toLower` to normalise before grouping, then `$switch` to map back to canonical names in the output. This preserves the original data in the database while producing clean analytics output.

### 8. Emergency Sensing Cycle

If the sensing service detects a signal drop ≥10 dBm between consecutive readings, it switches to a 1-minute emergency cycle to capture rapid signal degradation events (e.g., moving out of coverage, tower handover failures) with higher temporal resolution.

---

## 10. Signal Strength Measurement & Proxy Method

### The Core Problem

Measuring actual radio signal strength (RSRP — Reference Signal Received Power) requires access to cellular radio APIs. On **Expo managed workflow** (the configuration used by this project), the JavaScript layer does **not** have access to these low-level APIs. The `expo-cellular` library provides network type and carrier name, but not RSRP values.

On **Android bare workflow**, native modules like `react-native-telephony` or `react-native-android-telephony` can expose real RSRP and RSRQ values directly from the Android TelephonyManager. The schema includes `rsrp` and `rsrq` fields for this purpose (currently `null` in all managed workflow submissions).

On **iOS**, the CTCarrier API was deprecated in iOS 12 and largely blocked in iOS 16+. Real RSRP access is not possible through any public React Native API on iOS due to OS privacy restrictions.

### The Proxy Solution

The system implements a **latency-based signal strength proxy**:

1. The mobile app pings the backend `/health` endpoint and measures round-trip time.
2. This latency is mapped to a dBm-equivalent value on a fixed scale:

| Latency (ms) | Proxy Value (dBm) | Quality Label |
|---|---|---|
| < 50 | −55 | Excellent |
| 50 – 99 | −70 | Good |
| 100 – 199 | −85 | Fair |
| 200 – 399 | −100 | Poor |
| ≥ 400 | −115 | Very Poor |
| Timeout / null | −130 | No Connection |

3. The proxy value is stored as `signalStrength` in the database. The `rsrp` field remains `null`.

### Why This Works (and Where It Doesn't)

**Correlation:** Network latency is strongly correlated with signal quality under normal conditions — poor signal leads to retransmissions, congestion control, and longer RTTs. The proxy captures relative quality differences between carriers and locations.

**Limitations:**
- Latency is also affected by server load, routing, and internet backbone congestion — factors unrelated to radio signal quality.
- The mapping is a step function (discrete jumps), not a continuous measurement. Fine-grained differences within a quality tier are invisible.
- A device on a fast 4G connection with a congested ISP may appear to have poor signal when radio quality is actually excellent.

The proxy is appropriate for **comparative analysis** (carrier A vs. carrier B, area X vs. area Y) but should not be presented as equivalent to a proper RSRP measurement in absolute terms.

---

## 11. Spatial Indexing & Geohash

### MongoDB 2dsphere Index

The `location` field on both collections uses a MongoDB **2dsphere index**, which supports:

- `$geoNear` — find documents sorted by proximity to a point.
- `$geoWithin` — find documents within a polygon or bounding box.
- `$nearSphere` — spherical distance queries.

This index is essential for the heatmap bounding box filter and the "best network near me" feature.

### Geohash Precision Levels

| Precision | Cell Size (approx.) | Use Case |
|---|---|---|
| 4 | ~40 km × 20 km | Country/state overview |
| 5 | ~5 km × 5 km | City-level view |
| 6 | ~1.2 km × 0.6 km | Neighbourhood-level (default) |

The `getAggregatedHeatmapData` endpoint accepts a `precision` parameter (default: 5) that controls the substring length of the geohash used in `$group`. Using a prefix of the stored precision-6 geohash allows the same stored data to be aggregated at multiple zoom levels without re-encoding coordinates.

### Geohash Decoding for Response

After aggregation, `ngeohash.decode(geohash)` converts each cell's geohash back to a lat/lng coordinate pair representing the **centre** of that cell. This centre point is returned in the API response as a GeoJSON Point so the dashboard can plot each cell on a map.

---

## 12. Clustering & Dead Zone Detection

### DBSCAN Algorithm (`clusteringService.js`)

The system uses **DBSCAN** (Density-Based Spatial Clustering of Applications with Noise) from the `density-clustering` npm package to identify geographic clusters of poor signal / connectivity failure.

DBSCAN is appropriate for this use case because:
- It does not require specifying the number of clusters in advance (unlike k-means).
- It can identify clusters of arbitrary shape (relevant for road corridors, coastlines, etc.).
- Points that do not belong to any cluster are labelled as **noise** — useful for filtering isolated bad readings that are not a systemic problem.

### Haversine Distance

The clustering service uses the **Haversine formula** to compute great-circle distances between GPS coordinates. This is necessary because standard Euclidean distance is inaccurate at geographic scales where the Earth's curvature matters.

```
d = 2R · arctan2(√a, √(1−a))
a = sin²(Δφ/2) + cos(φ₁)cos(φ₂)sin²(Δλ/2)
```

where φ is latitude, λ is longitude, R is Earth's radius (6,371,000 m).

### Dead Zone Definition

A geographic area is classified as a **dead zone** when it has a cluster of data points where `connectivityFlag = false` — meaning multiple devices at multiple times have failed to connect from that location. Single isolated failures are excluded (DBSCAN noise filtering).

---

## 13. Caching Strategy

Redis is used exclusively for read-heavy, expensive aggregation queries.

| Endpoint | Cache Key Pattern | TTL |
|---|---|---|
| `GET /heatmap` | `heatmap:{provider}:{start}:{end}:{bbox}` | 5 minutes |
| `GET /heatmap/aggregated` | `aggregated:{params hash}` | 5 minutes |
| `GET /networks/best` | `best:{lat}:{lng}:{radius}` | 5 minutes |

**Cache invalidation:** TTL-based expiry only. There is no active invalidation on write — new data submitted during the 5-minute window will not appear in cached results until the TTL expires. This is acceptable because heatmap data is statistical in nature and small additions do not materially change aggregated values.

**Failure resilience:** All Redis operations are wrapped in try/catch. If Redis is unavailable, the system falls through to MongoDB for every request. This degrades performance but maintains correctness.

---

## 14. Known Limitations

### Signal Measurement Accuracy

As described in §10, the signal strength values are proxies derived from latency rather than direct radio measurements. They are suitable for comparative analysis but not for absolute signal characterisation.

### iOS Carrier Name

Apple deprecated the `CTCarrier` API in iOS 12 and began blocking it in iOS 16+. On iOS 16 and later, `expo-cellular.getCarrierNameAsync()` may return `null` or an empty string. Carrier detection is reliable only on Android.

### Background Collection Interval on iOS

iOS enforces a system-determined minimum background fetch interval (approximately 15 minutes). The app's requested 10-minute interval is not guaranteed — the OS may extend it based on battery state, usage patterns, and system load. Data collection on iOS is therefore less frequent than on Android.

### Geographic Scope

The validation layer restricts accepted data to the Nigerian bounding box (lat 4.0–14.0, lng 2.6–15.0). The system cannot be used in other countries without modifying these bounds in `networkController.js`.

### No Authentication

Write endpoints (`POST /api/networks`, `POST /api/reports`) are publicly accessible. This means anyone who discovers the API URL can submit arbitrary data. For a production deployment, API key authentication or device attestation would be required.

### No Data Deduplication

The backend does not deduplicate submissions. If the offline queue replays a packet that was already successfully submitted (e.g., due to a network race condition), a duplicate document will be created in the database.

### Expo Managed Workflow Constraints

The project uses Expo **managed workflow**, which provides convenience (no Xcode/Android Studio required for development) but restricts access to native APIs. Specifically:
- No direct RSRP/RSRQ access.
- No background location on Android without additional configuration.
- Limited control over background task scheduling.

Migrating to **bare workflow** or **React Native CLI** would unlock native telephony APIs for true signal measurement but significantly increases build and distribution complexity.

---

*Document generated for academic project defence. System: Network Analyser — Crowdsourced Mobile Network Quality Monitoring for Nigeria.*
