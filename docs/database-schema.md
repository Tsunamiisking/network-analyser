# Database Schema

## Overview

The system uses MongoDB as the primary database, leveraging its geospatial indexing capabilities, geohash-based clustering, and flexible document model.

## Collections

### 1. networkdata

Stores individual network signal measurements from mobile clients.

**Schema:**
```javascript
{
  _id: ObjectId,
  signalStrength: Number,      // dBm value (-120 to -20)
  location: {
    type: "Point",
    coordinates: [Number, Number]  // [longitude, latitude]
  },
  geohash: String,             // 6-character geohash (~1.2km precision)
  provider: String,            // Network provider name (e.g., "MTN", "Airtel")
  networkType: String,         // "3G", "4G", "5G"
  timestamp: Date              // Measurement time (auto-generated)
}
```

**Indexes:**
```javascript
// Geospatial index for location queries
db.networkdata.createIndex({ location: "2dsphere" })

// Geohash index for clustering queries
db.networkdata.createIndex({ geohash: 1 })

// Compound index for provider queries
db.networkdata.createIndex({ provider: 1, timestamp: -1 })

// Index for time-based queries and cleanup
db.networkdata.createIndex({ timestamp: -1 })
```

**Geohash Precision:**
- Precision 6 = ~1.2km × 0.6km cells
- Used for efficient clustering in aggregated heatmap queries
- Generated automatically on data insertion

**Data Retention:**
- Raw data: 90 days (recommended)
- Aggregated data: 2 years
- Automatic TTL index for cleanup (optional)

**Sample Document:**
```json
{
  "_id": ObjectId("65f3a1b2c4d5e6f7a8b9c0d1"),
  "signalStrength": -75,
  "location": {
    "type": "Point",
    "coordinates": [3.3792, 6.5244]
  },
  "geohash": "s0dxg1",
  "provider": "MTN",
  "networkType": "5G",
  "timestamp": ISODate("2026-03-06T10:30:00Z")
}
```

---

### 2. reports

**Schema:**
```javascript
{
  _id: ObjectId,
  provider: String,
  location: {
    type: "Point",
    coordinates: [Number, Number]
  },
  severity: String,            // "minor", "major", "critical"
  status: String,              // "active", "investigating", "resolved"
  description: String,
  affectedServices: [String],  // ["voice", "data", "sms"]
  reportedAt: Date,
  reportedBy: String,          // User ID or anonymous identifier
  confirmations: Number,       // Number of users confirming
  resolvedAt: Date,            // When marked as resolved
  metadata: {
    affectedRadius: Number,    // Estimated affected area in km
    durationMinutes: Number
  }
}
```

**Indexes:**
```javascript
db.outages.createIndex({ location: "2dsphere" })
db.outages.createIndex({ provider: 1, status: 1 })
db.outages.createIndex({ reportedAt: -1 })
```

**Sample Document:**
```json
{
  "_id": ObjectId("65f3a1b2c4d5e6f7a8b9c0d2"),
  "provider": "AT&T",
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "severity": "major",
  "status": "active",
  "description": "Complete loss of data service",
  "affectedServices": ["data"],
  "reportedAt": ISODate("2026-03-03T08:15:00Z"),
  "reportedBy": "anonymous_user_12345",
  "confirmations": 23,
  "resolvedAt": null,
  "metadata": {
    "affectedRadius": 5.0
  }
}
```

---

### 3. aggregations (Pre-computed)

Stores pre-aggregated statistics for faster queries.

**Schema:**
```javascript
{
  _id: ObjectId,
  aggregationType: String,     // "hourly", "daily", "weekly"
  period: Date,                // Start of aggregation period
  provider: String,
  region: {
    type: "Polygon",
    coordinates: [[[Number, Number]]]
  },
  statistics: {
    avgSignalStrength: Number,
    minSignalStrength: Number,
    maxSignalStrength: Number,
    stdDeviation: Number,
    measurementCount: Number,
    connectionTypes: {
      "5G": Number,
      "4G": Number,
      "LTE": Number
    }
  },
  computedAt: Date
}
```

**Indexes:**
```javascript
db.aggregations.createIndex({ 
  aggregationType: 1, 
  provider: 1, 
  period: -1 
})
db.aggregations.createIndex({ region: "2dsphere" })
```

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

### Find measurements within radius
```javascript
db.measurements.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [-122.4194, 37.7749]
      },
      $maxDistance: 5000  // 5km in meters
    }
  }
})
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
