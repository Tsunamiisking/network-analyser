# API Specification

## Base URL

```
Production: https://api.network-analyser.com
Development: http://localhost:3000
```

## Authentication

Currently, the API uses API key authentication for mobile clients and JWT tokens for web dashboard admin access.

### Headers
```
X-API-Key: <your-api-key>
Authorization: Bearer <jwt-token>
```

## Response Caching

All GET endpoints support Redis caching with a 5-minute TTL. Cached responses include a `cached: true` field.

## Endpoints

### 1. Network Data

#### POST /api/networks

Submit a new network signal measurement.

**Request Body:**
```json
{
  "signalStrength": -75,
  "latitude": 6.5244,
  "longitude": 3.3792,
  "provider": "MTN",
  "networkType": "5G"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Network data created successfully",
  "data": {
    "_id": "65f3a1b2c4d5e6f7a8b9c0d1",
    "signalStrength": -75,
    "provider": "MTN",
    "networkType": "5G",
    "location": {
      "type": "Point",
      "coordinates": [3.3792, 6.5244]
    },
    "geohash": "s0dxg1",
    "timestamp": "2026-03-06T10:30:00Z"
  }
}
```

**Validation Rules:**
- `signalStrength`: Required, number
- `latitude`: Required, float, range [-90, 90]
- `longitude`: Required, float, range [-180, 180]
- `provider`: Required, string
- `networkType`: Required, string (e.g., "3G", "4G", "5G")

**Features:**
- Automatically generates geohash (precision 6, ~1.2km) for efficient clustering
- Stores location as GeoJSON Point for geospatial queries
- Timestamp auto-generated if not provided

---

#### GET /api/networks/heatmap

Retrieve detailed network measurements for heatmap visualization.

**Query Parameters:**
- `provider`: Filter by provider (optional)
- `startDate`: Start date ISO 8601 (optional)
- `endDate`: End date ISO 8601 (optional)
- `minLat`: Minimum latitude for bounding box (optional)
- `maxLat`: Maximum latitude for bounding box (optional)
- `minLng`: Minimum longitude for bounding box (optional)
- `maxLng`: Maximum longitude for bounding box (optional)

**Example Request:**
```
GET /api/networks/heatmap?provider=MTN&minLat=6.4&maxLat=6.7&minLng=3.2&maxLng=3.5
```

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 2547,
  "cached": false,
  "data": [
    {
      "_id": "65f3a1b2c4d5e6f7a8b9c0d1",
      "signalStrength": -75,
      "location": {
        "type": "Point",
        "coordinates": [3.3792, 6.5244]
      },
      "provider": "MTN",
      "networkType": "5G",
      "timestamp": "2026-03-06T10:30:00Z"
    }
    // ... more measurements (max 5000)
  ]
}
```

**Notes:**
- Results limited to 5000 measurements for performance
- Cached for 5 minutes
- Use bounding box filters to reduce result size

---

#### GET /api/networks/heatmap/aggregated

Retrieve geohash-clustered network data for efficient heatmap rendering.

**Query Parameters:**
- `provider`: Filter by provider (optional)
- `startDate`: Start date ISO 8601 (optional)
- `endDate`: End date ISO 8601 (optional)
- `minLat`: Minimum latitude for bounding box (optional)
- `maxLat`: Maximum latitude for bounding box (optional)
- `minLng`: Minimum longitude for bounding box (optional)
- `maxLng`: Maximum longitude for bounding box (optional)
- `precision`: Geohash precision (default: 5, range: 4-6)
  - 4 = ~20km boxes
  - 5 = ~5km boxes
  - 6 = ~1.2km boxes

**Example Request:**
```
GET /api/networks/heatmap/aggregated?provider=MTN&precision=5&minLat=6.4&maxLat=6.7&minLng=3.2&maxLng=3.5
```

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 42,
  "precision": 5,
  "cached": false,
  "data": [
    {
      "geohash": "s0dxg",
      "avgSignalStrength": -72.45,
      "minSignalStrength": -95,
      "maxSignalStrength": -52,
      "count": 234,
      "providers": ["MTN", "Airtel"],
      "networkTypes": ["4G", "5G"],
      "location": {
        "type": "Point",
        "coordinates": [3.3792, 6.5244]
      }
    }
    // ... more clusters
  ]
}
```

**Benefits:**
- Returns 50-100 clusters instead of thousands of points
- Faster queries using geohash indexing
- Better for visualization performance
- Cached for 5 minutes

---

#### GET /api/networks/best

Find the best network provider in a specific area using geospatial aggregation.

**Query Parameters:**
- `lat`: Latitude (required)
- `lng`: Longitude (required)
- `radius`: Search radius in meters (default: 2000, max: 50000)

**Example Request:**
```
GET /api/networks/best?lat=6.5244&lng=3.3792&radius=2000
```

**Response:** `200 OK`
```json
{
  "success": true,
  "location": {
    "type": "Point",
    "coordinates": [3.3792, 6.5244]
  },
  "radius": 2000,
  "cached": false,
  "bestProvider": {
    "provider": "MTN",
    "avgSignalStrength": -65.23,
    "minSignalStrength": -85,
    "maxSignalStrength": -45,
    "count": 147,
    "avgDistance": 892.45,
    "networkTypes": ["4G", "5G"]
  },
  "allProviders": [
    {
      "provider": "MTN",
      "avgSignalStrength": -65.23,
      "minSignalStrength": -85,
      "maxSignalStrength": -45,
      "count": 147,
      "avgDistance": 892.45,
      "networkTypes": ["4G", "5G"]
    },
    {
      "provider": "Airtel",
      "avgSignalStrength": -72.10,
      "minSignalStrength": -92,
      "maxSignalStrength": -58,
      "count": 98,
      "avgDistance": 1124.67,
      "networkTypes": ["3G", "4G", "5G"]
    }
    // ... sorted by avgSignalStrength descending
  ]
}
```

**Use Cases:**
- "Which provider is best at my location?"
- Network recommendation systems
- Coverage comparison analysis

**Error Response:** `404 Not Found`
```json
{
  "success": false,
  "message": "No network data found within 2000m of the specified location"
}
```

---

### 2. Analytics
      "signalStrength": -75,
      "latitude": 37.7749,
      "longitude": -122.4194,
      "provider": "Verizon",
      "connectionType": "5G",
      "timestamp": "2026-03-03T10:30:00Z"
    },
    // ... more measurements
  ]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "accepted": 25,
  "rejected": 0,
  "message": "Batch processed successfully"
}
```

**Limits:**
- Maximum 100 measurements per batch
- Request size limit: 1MB

---

#### GET /measurements

Retrieve measurements with optional filters.

**Query Parameters:**
- `lat`: Latitude (required with lng, radius)
- `lng`: Longitude (required with lat, radius)
- `radius`: Radius in kilometers (default: 5, max: 50)
- `provider`: Filter by provider name
- `connectionType`: Filter by connection type
- `startDate`: Start date (ISO 8601)
- `endDate`: End date (ISO 8601)
- `limit`: Results per page (default: 100, max: 1000)
- `offset`: Pagination offset

**Example Request:**
```
GET /measurements?lat=37.7749&lng=-122.4194&radius=10&provider=Verizon&limit=50
```

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 50,
  "total": 1247,
  "measurements": [
    {
      "id": "65f3a1b2c4d5e6f7a8b9c0d1",
      "signalStrength": -75,
      "latitude": 37.7749,
      "longitude": -122.4194,
      "provider": "Verizon",
      "connectionType": "5G",
      "timestamp": "2026-03-03T10:30:00Z"
    }
    // ... more measurements
  ]
}
```

---

### 2. Analytics

#### GET /analytics/heatmap

Retrieve aggregated data for heatmap visualization.

**Query Parameters:**
- `bounds`: Map bounds as "swLat,swLng,neLat,neLng"
- `provider`: Filter by provider (optional)
- `startDate`: Start date (optional)
- `endDate`: End date (optional)
- `gridSize`: Grid cell size in km (default: 1)

**Example Request:**
```
GET /analytics/heatmap?bounds=37.7,-122.5,37.8,-122.3&provider=Verizon&gridSize=1
```

**Response:** `200 OK`
```json
{
  "success": true,
  "gridSize": 1,
  "cells": [
    {
      "latitude": 37.75,
      "longitude": -122.45,
      "avgSignalStrength": -72.5,
      "measurementCount": 145,
      "providers": ["Verizon", "AT&T"]
    }
    // ... more cells
  ]
}
```

---

#### GET /analytics/providers

Get aggregated statistics by provider.

**Query Parameters:**
- `lat`: Latitude (optional)
- `lng`: Longitude (optional)
- `radius`: Radius in km (default: 10)
- `startDate`: Start date (optional)
- `endDate`: End date (optional)

**Response:** `200 OK`
```json
{
  "success": true,
  "providers": [
    {
      "name": "Verizon",
      "avgSignalStrength": -68.2,
      "minSignalStrength": -95,
      "maxSignalStrength": -45,
      "measurementCount": 5420,
      "coverageArea": 234.5
    }
    // ... more providers
  ]
}
```

---

#### GET /analytics/trends

Get time-series trends for signal strength.

**Query Parameters:**
- `provider`: Provider name (required)
- `lat`: Latitude (optional)
- `lng`: Longitude (optional)
- `radius`: Radius in km (default: 10)
- `startDate`: Start date (required)
- `endDate`: End date (required)
- `interval`: Aggregation interval (hour, day, week, month)

**Response:** `200 OK`
```json
{
  "success": true,
  "provider": "Verizon",
  "interval": "day",
  "data": [
    {
      "timestamp": "2026-03-01T00:00:00Z",
      "avgSignalStrength": -70.5,
      "measurementCount": 342
    }
    // ... more data points
  ]
}
```

---

### 3. Outages

#### POST /outages

Report a network outage.

**Request Body:**
```json
{
  "provider": "AT&T",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "severity": "major",
  "description": "Complete loss of service",
  "affectedServices": ["voice", "data"]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "outageId": "65f3a1b2c4d5e6f7a8b9c0d2",
  "message": "Outage reported successfully"
}
```

---

#### GET /outages

Retrieve active outages.

**Query Parameters:**
- `lat`: Latitude (optional)
- `lng`: Longitude (optional)
- `radius`: Radius in km (default: 50)
- `provider`: Filter by provider (optional)
- `status`: Filter by status (active, resolved)

**Response:** `200 OK`
```json
{
  "success": true,
  "outages": [
    {
      "id": "65f3a1b2c4d5e6f7a8b9c0d2",
      "provider": "AT&T",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "severity": "major",
      "status": "active",
      "reportCount": 23,
      "reportedAt": "2026-03-03T08:15:00Z"
    }
  ]
}
```

---

### 4. Admin (Protected)

#### GET /admin/stats

Get system-wide statistics.

**Requires:** Admin JWT token

**Response:** `200 OK`
```json
{
  "success": true,
  "stats": {
    "totalMeasurements": 1245678,
    "activeMobileClients": 342,
    "providers": 5,
    "avgMeasurementsPerDay": 12456,
    "lastMeasurementAt": "2026-03-03T12:45:00Z"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid request parameters",
  "details": {
    "signalStrength": "Must be between -120 and -20"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "requestId": "req_123abc"
}
```

## Rate Limits

- Mobile clients: 100 requests per minute
- Web dashboard: 500 requests per minute
- Batch endpoint: 10 requests per minute

## Versioning

API version is included in the URL path (`/v1`). Breaking changes will result in a new version (`/v2`).

## Related Documentation
- [System Design](system-design.md)
- [Database Schema](database-schema.md)
- [Security](security.md)
