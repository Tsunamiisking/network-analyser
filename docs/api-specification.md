# API Specification

## Base URL

```
Production: https://api.network-analyser.com/v1
Development: http://localhost:3000/api/v1
```

## Authentication

Currently, the API uses API key authentication for mobile clients and JWT tokens for web dashboard admin access.

### Headers
```
X-API-Key: <your-api-key>
Authorization: Bearer <jwt-token>
```

## Endpoints

### 1. Measurements

#### POST /measurements

Submit a new signal strength measurement.

**Request Body:**
```json
{
  "signalStrength": -75,
  "latitude": 37.7749,
  "longitude": -122.4194,
  "provider": "Verizon",
  "connectionType": "5G",
  "timestamp": "2026-03-03T10:30:00Z",
  "deviceInfo": {
    "platform": "iOS",
    "osVersion": "17.2"
  }
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "measurementId": "65f3a1b2c4d5e6f7a8b9c0d1",
  "message": "Measurement recorded successfully"
}
```

**Validation Rules:**
- `signalStrength`: Required, integer, range [-120, -20]
- `latitude`: Required, float, range [-90, 90]
- `longitude`: Required, float, range [-180, 180]
- `provider`: Required, string, max 50 chars
- `connectionType`: Required, enum ["2G", "3G", "4G", "5G", "LTE"]
- `timestamp`: Required, ISO 8601 format

---

#### POST /measurements/batch

Submit multiple measurements in a single request.

**Request Body:**
```json
{
  "measurements": [
    {
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
