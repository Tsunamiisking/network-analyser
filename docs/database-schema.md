# Database Schema

## Overview

The system uses MongoDB as the primary database, leveraging its geospatial indexing capabilities and flexible document model.

## Collections

### 1. measurements

Stores individual signal strength measurements from mobile clients.

**Schema:**
```javascript
{
  _id: ObjectId,
  signalStrength: Number,      // dBm value (-120 to -20)
  location: {
    type: "Point",
    coordinates: [Number, Number]  // [longitude, latitude]
  },
  provider: String,            // Network provider name
  connectionType: String,      // "2G", "3G", "4G", "5G", "LTE"
  timestamp: Date,             // Measurement time
  deviceInfo: {
    platform: String,          // "iOS" or "Android"
    osVersion: String,
    appVersion: String
  },
  metadata: {
    accuracy: Number,          // GPS accuracy in meters
    altitude: Number,          // Optional
    speed: Number,             // Optional
    heading: Number            // Optional
  },
  submittedAt: Date,           // Server receipt time
  ipAddress: String            // For abuse detection
}
```

**Indexes:**
```javascript
// Geospatial index for location queries
db.measurements.createIndex({ location: "2dsphere" })

// Compound index for provider + time queries
db.measurements.createIndex({ provider: 1, timestamp: -1 })

// Index for time-based queries and cleanup
db.measurements.createIndex({ timestamp: -1 })

// Compound index for provider + connection type stats
db.measurements.createIndex({ provider: 1, connectionType: 1 })
```

**Data Retention:**
- Raw data: 90 days
- Aggregated data: 2 years
- Automatic TTL index for cleanup

**Sample Document:**
```json
{
  "_id": ObjectId("65f3a1b2c4d5e6f7a8b9c0d1"),
  "signalStrength": -75,
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "provider": "Verizon",
  "connectionType": "5G",
  "timestamp": ISODate("2026-03-03T10:30:00Z"),
  "deviceInfo": {
    "platform": "iOS",
    "osVersion": "17.2",
    "appVersion": "1.2.0"
  },
  "metadata": {
    "accuracy": 15.5,
    "altitude": 52.0
  },
  "submittedAt": ISODate("2026-03-03T10:30:05Z"),
  "ipAddress": "203.0.113.42"
}
```

---

### 2. outages

Stores manual outage reports from users.

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
