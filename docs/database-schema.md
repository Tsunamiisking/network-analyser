# Database Schema

## Overview

The system uses MongoDB as the primary database, leveraging its geospatial indexing capabilities, geohash-based clustering, and flexible document model.

## Collections

### 1. networkdata

Stores individual network signal measurements submitted by mobile clients (both foreground and background collection).

**Schema:**
```javascript
{
  _id: ObjectId,
  provider: String,            // Nigerian carrier: "MTN", "Airtel", "Glo", "9mobile"
  signalStrength: Number,      // dBm proxy derived from latency measurement
  networkType: String,         // "2G", "3G", "4G", "5G", "Unknown"
  location: {
    type: "Point",
    coordinates: [Number, Number]  // [longitude, latitude] — GeoJSON order
  },
  locationName: String,        // Human-readable name, e.g. "Victoria Island, Lagos" (nullable)
  geohash: String,             // 6-character geohash (~1.2km × 0.6km cell), auto-generated
  rsrp: Number,                // Reference Signal Received Power (dBm), 3GPP range: -44 to -140
                               // null on iOS and Expo managed workflow (OS restriction)
  rsrq: Number,                // Reference Signal Received Quality (dB), null when unavailable
  connectivityFlag: Boolean,   // false = device had no data connection at measurement time
                               // Captures dead-zone / blackout readings (anti-survivorship-bias)
  deviceId: String,            // Anonymous UUID stored in AsyncStorage (not linked to identity)
  timestamp: Date              // Server-side insertion time (auto-generated)
}
```

**Indexes:**
```javascript
db.networkdata.createIndex({ location: "2dsphere" })          // Geospatial queries
db.networkdata.createIndex({ geohash: 1 })                    // Heatmap aggregation
db.networkdata.createIndex({ deviceId: 1, timestamp: -1 })    // Per-device history
db.networkdata.createIndex({ connectivityFlag: 1 })           // Dead zone queries
db.networkdata.createIndex({ provider: 1, geohash: 1, timestamp: -1 }) // Aggregated heatmap
```

**Signal Strength Note:**
True RSRP access is unavailable in Expo managed workflow. `signalStrength` is a
latency-to-dBm proxy computed by the sensing engine:

| Latency (ms) | Proxy dBm | Quality     |
|-------------|-----------|-------------|
| < 50        | −55       | Excellent   |
| 50–100      | −70       | Good        |
| 100–200     | −85       | Fair        |
| 200–400     | −100      | Poor        |
| > 400       | −115      | Very Poor   |
| Timeout     | −130      | Blackout    |

**Geohash Precision:**
- Precision 6 = ~1.2 km × 0.6 km cells
- Used for geohash-grouping in the aggregated heatmap pipeline
- Generated server-side via `ngeohash.encode(lat, lng, 6)` on every insertion

**Sample Document:**
```json
{
  "_id": "65f3a1b2c4d5e6f7a8b9c0d1",
  "provider": "MTN",
  "signalStrength": -85,
  "networkType": "4G",
  "location": { "type": "Point", "coordinates": [3.3792, 6.5244] },
  "locationName": "Victoria Island, Lagos",
  "geohash": "s0dxg1",
  "rsrp": null,
  "rsrq": null,
  "connectivityFlag": true,
  "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-05-17T10:30:00.000Z"
}
```

---

### 2. reports

Stores manual outage reports submitted by users via the Report tab. Designed for
intermittent issues that background auto-collection may miss.

**Schema:**
```javascript
{
  _id: ObjectId,
  provider: String,    // Required. Enum: "MTN" | "Airtel" | "Glo" | "9mobile"
  issueType: String,   // Required. Enum: "No Signal" | "Slow Internet" | "Call Drop" | "No Data"
  description: String, // Optional free-text detail (trimmed, no max length enforced)
  location: {
    type: "Point",
    coordinates: [Number, Number]  // [longitude, latitude] — GeoJSON order
  },
  timestamp: Date,     // Submission time (auto-generated server-side)
  occurredAt: Date,    // Optional: when the issue actually occurred (may predate submission)
                       // null if user selected "Just now" or left blank
}
```

**Indexes:**
```javascript
db.reports.createIndex({ location: "2dsphere" })
db.reports.createIndex({ provider: 1, timestamp: -1 })
```

**occurredAt vs timestamp:**
The form lets users specify how long ago an issue occurred (e.g. "~1 hour ago").
`occurredAt` stores that computed time; `timestamp` always reflects when the report
was saved. The heatmap callout uses `occurredAt` as the primary event time and
displays a "reported X later" note when the lag exceeds 5 minutes.

**Sample Document:**
```json
{
  "_id": "65f3a1b2c4d5e6f7a8b9c0d2",
  "provider": "MTN",
  "issueType": "No Signal",
  "description": "No bars at all near the market",
  "location": { "type": "Point", "coordinates": [3.8056, 7.3780] },
  "timestamp": "2026-05-17T22:40:46.594Z",
  "occurredAt": "2026-05-17T21:40:46.000Z"
}
```

---

### Note on Aggregations

There is no separate pre-computed aggregations collection. All heatmap aggregation
is performed **on-demand** via MongoDB aggregation pipelines grouped by `geohash`
(precision 6). Results are cached in Redis for 5 minutes (TTL = 300 s) with cache
keys of the form `heatmap:aggregated:*`. This removes the need for a scheduled
batch job and keeps the schema simple.

---

### 4. users (Future Extension)

For authenticated users and contributor tracking.

**Schema:**
```javascript
{
  _id: ObjectId,
  email: String,
  passwordHash: String,
  role: String,                // "user", "admin", "analyst"
  profile: {
    displayName: String,
    avatar: String
  },
  statistics: {
    measurementsSubmitted: Number,
    outagesReported: Number,
    joinedAt: Date,
    lastActiveAt: Date
  },
  preferences: {
    emailNotifications: Boolean,
    defaultProvider: String
  },
  apiKey: String,              // For mobile app authentication
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```javascript
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ apiKey: 1 }, { unique: true })
```

---

## Geospatial Queries

### Find measurements within radius (Nigeria, Lagos example)
```javascript
db.networkdata.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [3.3792, 6.5244] },
      $maxDistance: 5000  // 5 km
    }
  }
})
```

### Aggregated heatmap by geohash (used by GET /api/networks/heatmap/aggregated)
```javascript
db.networkdata.aggregate([
  { $match: { provider: "MTN" } },
  {
    $group: {
      _id: { $substr: ["$geohash", 0, 6] },
      medianSignalStrength: { /* percentile approximation */ },
      count: { $sum: 1 },
      providers: { $addToSet: "$provider" }
    }
  }
])
```
```

### Find measurements within bounds
```javascript
db.measurements.find({
  location: {
    $geoWithin: {
      $box: [
        [-122.5, 37.7],  // Southwest corner
        [-122.3, 37.8]   // Northeast corner
      ]
    }
  }
})
```

---

## Aggregation Pipelines

### Average signal strength by provider in area
```javascript
db.measurements.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-122.4194, 37.7749] },
      distanceField: "distance",
      maxDistance: 5000,
      spherical: true
    }
  },
  {
    $group: {
      _id: "$provider",
      avgSignal: { $avg: "$signalStrength" },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { avgSignal: -1 }
  }
])
```

### Time-series aggregation
```javascript
db.measurements.aggregate([
  {
    $match: {
      provider: "Verizon",
      timestamp: { 
        $gte: ISODate("2026-03-01"),
        $lte: ISODate("2026-03-03")
      }
    }
  },
  {
    $group: {
      _id: {
        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
      },
      avgSignal: { $avg: "$signalStrength" },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { _id: 1 }
  }
])
```

---

## Data Management

### Backup Strategy
- Daily automated backups via MongoDB Atlas
- Point-in-time recovery enabled
- Backup retention: 30 days

### Sharding Strategy
- Shard key: `{ provider: 1, timestamp: 1 }`
- Geographic distribution for reduced latency
- Tag-aware sharding for regional data

### Data Cleanup
```javascript
// TTL index for automatic cleanup
db.measurements.createIndex(
  { "timestamp": 1 },
  { expireAfterSeconds: 7776000 }  // 90 days
)
```

## Related Documentation
- [System Design](system-design.md)
- [API Specification](api-specification.md)
- [Data Processing](data-processing.md)
- [Performance](performance.md)
