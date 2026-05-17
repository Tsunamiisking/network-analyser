# API Specification

## Base URL

```
Development: http://<host>:3000/api
```

All endpoints are prefixed with `/api`. No authentication is required — the API is open and designed for anonymous, crowdsourced contributions.

## Response Caching

GET endpoints are cached in Redis with a 5-minute TTL (300 seconds). Cached responses include `"cached": true`. Cache keys are invalidated on relevant write operations (e.g. submitting a report clears all `reports:*` keys immediately).

## Common Response Format

```json
{
  "success": true,
  "count": 42,
  "data": [...],
  "cached": false
}
```

Errors return:
```json
{ "message": "Human-readable error description" }
```

---

## 1. Network Data — `/api/networks`

### POST /api/networks

Submit a new network signal measurement from a mobile client.

**Request Body:**
```json
{
  "signalStrength": -85,
  "provider": "MTN",
  "networkType": "4G",
  "latitude": 6.5244,
  "longitude": 3.3792,
  "rsrp": null,
  "rsrq": null,
  "connectivityFlag": true,
  "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `signalStrength` | Number | ✅ | dBm proxy derived from latency test |
| `provider` | String | ✅ | Nigerian carriers: MTN, Airtel, Glo, 9mobile |
| `networkType` | String | ✅ | "2G" / "3G" / "4G" / "5G" / "Unknown" |
| `latitude` | Number | ✅ | Must be within Nigeria bounding box (4.0–14.0) |
| `longitude` | Number | ✅ | Must be within Nigeria bounding box (2.6–15.0) |
| `rsrp` | Number | ❌ | Raw RSRP in dBm (–44 to –140); null on iOS/Expo managed |
| `rsrq` | Number | ❌ | Raw RSRQ in dB; null when unavailable |
| `connectivityFlag` | Boolean | ❌ | false = no data connection at time of measurement (default: true) |
| `deviceId` | String | ❌ | Anonymous UUID for per-device history |

**Validation:**
- Coordinates rejected outside Nigeria bounding box
- RSRP rejected outside –44 to –140 dBm (3GPP spec)
- Geohash (precision 6, ~1.2 km) is auto-generated server-side via `ngeohash`

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Network data created successfully",
  "data": {
    "_id": "65f3a1b2c4d5e6f7a8b9c0d1",
    "signalStrength": -85,
    "provider": "MTN",
    "networkType": "4G",
    "location": { "type": "Point", "coordinates": [3.3792, 6.5244] },
    "geohash": "s0dxg1",
    "connectivityFlag": true,
    "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timestamp": "2026-05-17T10:30:00.000Z"
  }
}
```

---

### GET /api/networks/heatmap

Returns raw measurements (up to 5,000) for heatmap rendering. Prefer the aggregated endpoint for the mobile app — this endpoint is useful for debugging or small datasets.

**Query Parameters:**

| Param | Type | Notes |
|-------|------|-------|
| `provider` | String | Filter by carrier (optional) |
| `startDate` / `endDate` | ISO 8601 | Time range (optional) |
| `minLat` / `maxLat` / `minLng` / `maxLng` | Number | Bounding box (optional) |

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 312,
  "cached": false,
  "data": [
    {
      "_id": "65f3a1b2c4d5e6f7a8b9c0d1",
      "signalStrength": -85,
      "location": { "type": "Point", "coordinates": [3.3792, 6.5244] },
      "provider": "MTN",
      "networkType": "4G",
      "timestamp": "2026-05-17T10:30:00.000Z"
    }
  ]
}
```

---

### GET /api/networks/heatmap/aggregated

Returns geohash-clustered network data. Each item represents one geohash cell with aggregated signal statistics. **Primary endpoint used by the mobile heatmap for all three display modes (signal strength / quality level / dead zones).**

**Query Parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `provider` | String | — | Filter by carrier (optional) |
| `precision` | Number | 5 | Geohash precision: 4 (~20 km), 5 (~5 km), 6 (~1.2 km) |
| `startDate` / `endDate` | ISO 8601 | — | Time range (optional) |
| `minLat` / `maxLat` / `minLng` / `maxLng` | Number | — | Bounding box (optional) |

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 47,
  "precision": 6,
  "cached": false,
  "data": [
    {
      "geohash": "s0dxg1",
      "medianSignalStrength": -87,
      "minSignalStrength": -115,
      "maxSignalStrength": -65,
      "count": 34,
      "providers": ["MTN", "Airtel"],
      "networkTypes": ["4G"],
      "location": { "type": "Point", "coordinates": [3.3792, 6.5244] }
    }
  ]
}
```

**Note:** `medianSignalStrength` (not average) reduces the impact of outlier readings. Computed in JavaScript after the MongoDB aggregation pipeline.

The mobile app filters this response client-side for the three heatmap modes:
- **Signal heatmap** — all cells coloured by `medianSignalStrength`
- **Quality mode** — cells filtered to a specific dBm range (e.g. Excellent: > −85)
- **Dead zones** — cells where `medianSignalStrength` ≤ −115 dBm

---

### GET /api/networks/best

Returns all providers ranked by average signal strength within a radius. Used by the **Best Network** tab to recommend a carrier at the user's current location.

**Query Parameters:**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `lat` | Number | ✅ | User latitude |
| `lng` | Number | ✅ | User longitude |
| `radius` | Number | ❌ | Metres (default: 2000, max: 50 000) |

**Response:** `200 OK`
```json
{
  "success": true,
  "cached": false,
  "data": [
    { "provider": "MTN",    "avgSignalStrength": -72.4, "count": 147, "networkTypes": ["4G","5G"] },
    { "provider": "Airtel", "avgSignalStrength": -81.2, "count": 98,  "networkTypes": ["3G","4G"] }
  ]
}
```

Returns `404` when no data exists within the requested radius.

---

### GET /api/networks/deadzones

Returns DBSCAN-clustered dead-zone regions — areas where `connectivityFlag = false` readings are spatially dense enough to indicate a persistent no-service zone.

Accepts the same optional bounding box / provider / time query parameters as `/heatmap`.

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 3,
  "cached": false,
  "data": [
    { "centroid": { "type": "Point", "coordinates": [3.38, 6.51] }, "radius": 450, "count": 12 }
  ]
}
```

---

### GET /api/networks/history

Returns the 50 most recent measurements submitted by a specific device. Used by the **History** tab.

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `deviceId` | String | ✅ |

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "signalStrength": -85,
      "provider": "MTN",
      "networkType": "4G",
      "location": { "type": "Point", "coordinates": [3.3792, 6.5244] },
      "timestamp": "2026-05-17T10:30:00.000Z"
    }
  ]
}
```

---

## 2. Manual Reports — `/api/reports`

### POST /api/reports

Submit a manual network issue report. Designed for intermittent or past events (call drops, slow internet) that background auto-collection may not capture.

**Request Body:**
```json
{
  "provider": "MTN",
  "issueType": "No Signal",
  "description": "No bars at all near the market",
  "latitude": 7.3780,
  "longitude": 3.8056,
  "occurredAt": "2026-05-17T21:40:00.000Z"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `provider` | String | ✅ | Enum: "MTN" \| "Airtel" \| "Glo" \| "9mobile" |
| `issueType` | String | ✅ | Enum: "No Signal" \| "Slow Internet" \| "Call Drop" \| "No Data" |
| `latitude` | Number | ✅ | Within Nigeria bounding box |
| `longitude` | Number | ✅ | Within Nigeria bounding box |
| `description` | String | ❌ | Free-text additional detail |
| `occurredAt` | ISO 8601 | ❌ | When the issue occurred; omit or null for real-time reports |

On success, all `reports:*` Redis cache keys are **immediately invalidated** so the new pin appears on the heatmap on the next fetch.

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Report submitted successfully",
  "data": {
    "_id": "65f3a1b2c4d5e6f7a8b9c0d3",
    "provider": "MTN",
    "issueType": "No Signal",
    "location": { "type": "Point", "coordinates": [3.8056, 7.3780] },
    "timestamp": "2026-05-17T22:40:46.594Z",
    "occurredAt": "2026-05-17T21:40:00.000Z"
  }
}
```

---

### GET /api/reports

Returns manual reports. Used by the heatmap overlay to render issue-type markers.

**Query Parameters:**

| Param | Type | Notes |
|-------|------|-------|
| `provider` | String | Filter by carrier (optional) |
| `startDate` / `endDate` | ISO 8601 | Time range (optional) |
| `minLat` / `maxLat` / `minLng` / `maxLng` | Number | Bounding box (optional) |

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 1,
  "cached": false,
  "data": [
    {
      "provider": "MTN",
      "issueType": "No Signal",
      "description": "",
      "location": { "type": "Point", "coordinates": [3.8056, 7.3780] },
      "timestamp": "2026-05-17T22:40:46.594Z"
    }
  ]
}
```

---

## 3. Analytics — `/api/analytics`

### GET /api/analytics/provider-comparison

Returns average signal strength and sample count per provider across all collected data. Used by the **Best** tab to give a global overview.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    { "provider": "MTN",     "averageSignal": -78.45, "totalSamples": 512 },
    { "provider": "Airtel",  "averageSignal": -83.10, "totalSamples": 298 },
    { "provider": "Glo",     "averageSignal": -91.20, "totalSamples": 145 },
    { "provider": "9mobile", "averageSignal": -94.80, "totalSamples": 88  }
  ]
}
```

Results sorted by `averageSignal` descending (best first).

---

### GET /api/analytics/blackout-rate

Returns the percentage of measurements where `connectivityFlag = false` (device had no data connection), indicating blackout / dead-zone prevalence per provider.

**Query Parameters:**

| Param | Type | Notes |
|-------|------|-------|
| `startDate` / `endDate` | ISO 8601 | Optional time range |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    { "provider": "Glo",  "totalMeasurements": 145, "blackouts": 32, "blackoutRate": 22.07 },
    { "provider": "MTN",  "totalMeasurements": 512, "blackouts": 18, "blackoutRate": 3.52  }
  ]
}
```

---

## Signal Quality Tiers

Applied consistently across the mobile app, backend clustering, and documentation:

| Tier | dBm Range | Heatmap Colour |
|------|-----------|----------------|
| Excellent | > −85 dBm | Green `#22C55E` |
| Good | −95 to −85 dBm | Light green `#86EFAC` |
| Fair | −105 to −95 dBm | Yellow `#EAB308` |
| Poor | −115 to −105 dBm | Orange `#F97316` |
| Very Poor | ≤ −115 dBm | Red `#EF4444` |

## Related Documentation

- [Database Schema](database-schema.md)
- [Data Processing](data-processing.md)
- [Limitations](limitations.md)
- [System Design](system-design.md)
