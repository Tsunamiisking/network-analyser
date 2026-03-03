# Data Processing

## Overview

The data processing pipeline handles the transformation, validation, aggregation, and analysis of network measurement data from collection to visualization.

## Data Flow Pipeline

```
┌──────────────┐
│ Mobile App   │ Collects raw measurements
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ 1. Ingestion Layer                       │
│ • Receive measurements                   │
│ • Initial validation                     │
│ • Rate limiting                          │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ 2. Validation & Enrichment Layer        │
│ • Data quality checks                    │
│ • Coordinate validation                  │
│ • Provider normalization                 │
│ • Timestamp standardization              │
│ • IP geolocation                         │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ 3. Storage Layer                         │
│ • Persist to MongoDB                     │
│ • Geospatial indexing                    │
│ • Time-series optimization               │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ 4. Aggregation Layer                     │
│ • Real-time aggregation                  │
│ • Scheduled batch processing             │
│ • Statistical computation                │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ 5. Analytics & Serving Layer             │
│ • Query optimization                     │
│ • Result caching                         │
│ • API response formatting                │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────┐
│ Web Dashboard│ Visualizes processed data
└──────────────┘
```

## 1. Ingestion Layer

### Request Handling

**Responsibilities**:
- Accept incoming measurements via REST API
- Perform preliminary validation
- Apply rate limiting
- Route to appropriate handlers

**Implementation:**
```javascript
// backend/routes/measurements.js
app.post('/api/v1/measurements', 
  rateLimiter({ max: 100, windowMs: 60000 }),
  async (req, res) => {
    try {
      // Quick validation
      if (!req.body.signalStrength || !req.body.latitude) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields' 
        });
      }
      
      // Queue for processing
      await measurementQueue.add({
        measurement: req.body,
        clientIp: req.ip,
        timestamp: new Date()
      });
      
      res.status(202).json({ 
        success: true, 
        message: 'Measurement queued' 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Processing error' 
      });
    }
  }
);
```

### Batch Processing

**Responsibilities**:
- Accept bulk uploads (up to 100 measurements)
- Validate batch integrity
- Process in parallel

**Implementation:**
```javascript
app.post('/api/v1/measurements/batch', async (req, res) => {
  const { measurements } = req.body;
  
  if (!Array.isArray(measurements) || measurements.length > 100) {
    return res.status(400).json({ error: 'Invalid batch' });
  }
  
  const results = await Promise.allSettled(
    measurements.map(m => processMeasurement(m))
  );
  
  const accepted = results.filter(r => r.status === 'fulfilled').length;
  const rejected = results.length - accepted;
  
  res.status(201).json({ success: true, accepted, rejected });
});
```

## 2. Validation & Enrichment Layer

### Data Quality Checks

**Signal Strength Validation**:
```javascript
function validateSignalStrength(value) {
  // dBm typically ranges from -120 (very poor) to -20 (excellent)
  if (typeof value !== 'number') return false;
  if (value < -120 || value > -20) return false;
  return true;
}
```

**Coordinate Validation**:
```javascript
function validateCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  
  // Check for common invalid values
  if (lat === 0 && lng === 0) return false; // Null Island
  
  return true;
}
```

**GPS Accuracy Filtering**:
```javascript
function acceptableAccuracy(accuracy) {
  // Only accept measurements with GPS accuracy better than 100m
  return accuracy && accuracy < 100;
}
```

### Data Enrichment

**Provider Normalization**:
```javascript
const providerAliases = {
  'Verizon Wireless': 'Verizon',
  'AT&T Mobility': 'AT&T',
  'T-Mobile USA': 'T-Mobile',
  // ... more mappings
};

function normalizeProvider(provider) {
  return providerAliases[provider] || provider;
}
```

**Timestamp Standardization**:
```javascript
function standardizeTimestamp(timestamp) {
  const date = new Date(timestamp);
  
  // Reject future timestamps
  if (date > new Date()) {
    throw new Error('Invalid timestamp');
  }
  
  // Reject very old timestamps (> 24 hours)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (date < dayAgo) {
    throw new Error('Timestamp too old');
  }
  
  return date;
}
```

**IP Geolocation** (optional verification):
```javascript
async function enrichWithIpLocation(measurement, ipAddress) {
  const ipLocation = await geoipService.lookup(ipAddress);
  
  // Calculate distance between GPS and IP location
  const distance = calculateDistance(
    measurement.latitude,
    measurement.longitude,
    ipLocation.lat,
    ipLocation.lng
  );
  
  // Flag suspicious measurements (GPS and IP very far apart)
  if (distance > 1000) { // > 1000km
    measurement.flags = ['suspicious_location'];
  }
  
  return measurement;
}
```

## 3. Storage Layer

### Data Persistence

**Measurement Storage**:
```javascript
async function storeMeasurement(measurement) {
  const doc = {
    signalStrength: measurement.signalStrength,
    location: {
      type: 'Point',
      coordinates: [measurement.longitude, measurement.latitude]
    },
    provider: normalizeProvider(measurement.provider),
    connectionType: measurement.connectionType,
    timestamp: standardizeTimestamp(measurement.timestamp),
    deviceInfo: measurement.deviceInfo,
    metadata: {
      accuracy: measurement.metadata?.accuracy,
      submittedAt: new Date()
    }
  };
  
  return await db.collection('measurements').insertOne(doc);
}
```

### Index Management

**Critical Indexes**:
```javascript
// Geospatial queries
db.measurements.createIndex({ location: "2dsphere" });

// Time-series queries
db.measurements.createIndex({ timestamp: -1 });

// Provider-specific queries
db.measurements.createIndex({ provider: 1, timestamp: -1 });

// Compound index for complex queries
db.measurements.createIndex({ 
  provider: 1, 
  connectionType: 1, 
  timestamp: -1 
});
```

## 4. Aggregation Layer

### Real-Time Aggregation

**Heatmap Data Generation**:
```javascript
async function generateHeatmapData(bounds, provider, gridSize = 1) {
  const pipeline = [
    // Filter by geographic bounds
    {
      $match: {
        location: {
          $geoWithin: {
            $box: [
              [bounds.swLng, bounds.swLat],
              [bounds.neLng, bounds.neLat]
            ]
          }
        },
        ...(provider && { provider })
      }
    },
    // Group by grid cell
    {
      $group: {
        _id: {
          // Round coordinates to grid size
          lat: { 
            $multiply: [
              { $floor: { $divide: ["$location.coordinates.1", gridSize] } },
              gridSize
            ]
          },
          lng: {
            $multiply: [
              { $floor: { $divide: ["$location.coordinates.0", gridSize] } },
              gridSize
            ]
          }
        },
        avgSignalStrength: { $avg: "$signalStrength" },
        minSignalStrength: { $min: "$signalStrength" },
        maxSignalStrength: { $max: "$signalStrength" },
        count: { $sum: 1 }
      }
    },
    // Format output
    {
      $project: {
        latitude: "$_id.lat",
        longitude: "$_id.lng",
        avgSignalStrength: 1,
        minSignalStrength: 1,
        maxSignalStrength: 1,
        measurementCount: "$count"
      }
    }
  ];
  
  return await db.collection('measurements').aggregate(pipeline).toArray();
}
```

### Scheduled Batch Processing

**Hourly Aggregation**:
```javascript
// Runs every hour via cron job
async function aggregateHourlyStats() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const pipeline = [
    {
      $match: {
        timestamp: { $gte: oneHourAgo }
      }
    },
    {
      $group: {
        _id: {
          provider: "$provider",
          connectionType: "$connectionType",
          hour: { $dateToString: { format: "%Y-%m-%d-%H", date: "$timestamp" } }
        },
        avgSignal: { $avg: "$signalStrength" },
        minSignal: { $min: "$signalStrength" },
        maxSignal: { $max: "$signalStrength" },
        count: { $sum: 1 },
        stdDev: { $stdDevPop: "$signalStrength" }
      }
    }
  ];
  
  const results = await db.collection('measurements').aggregate(pipeline).toArray();
  
  // Store in aggregations collection
  await db.collection('aggregations').insertMany(
    results.map(r => ({
      ...r,
      aggregationType: 'hourly',
      period: new Date(r._id.hour),
      computedAt: new Date()
    }))
  );
}
```

**Provider Statistics**:
```javascript
async function calculateProviderStats(location, radius) {
  const pipeline = [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [location.lng, location.lat] },
        distanceField: "distance",
        maxDistance: radius * 1000, // km to meters
        spherical: true
      }
    },
    {
      $group: {
        _id: "$provider",
        avgSignal: { $avg: "$signalStrength" },
        minSignal: { $min: "$signalStrength" },
        maxSignal: { $max: "$signalStrength" },
        p25: { $percentile: { input: "$signalStrength", p: [0.25], method: 'approximate' } },
        p50: { $percentile: { input: "$signalStrength", p: [0.50], method: 'approximate' } },
        p75: { $percentile: { input: "$signalStrength", p: [0.75], method: 'approximate' } },
        count: { $sum: 1 },
        connectionTypes: { $addToSet: "$connectionType" }
      }
    },
    {
      $sort: { avgSignal: -1 }
    }
  ];
  
  return await db.collection('measurements').aggregate(pipeline).toArray();
}
```

### Time-Series Analysis

**Trend Detection**:
```javascript
async function detectTrends(provider, location, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const pipeline = [
    {
      $match: {
        provider,
        timestamp: { $gte: startDate },
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [location.lng, location.lat] },
            $maxDistance: 10000 // 10km
          }
        }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
        avgSignal: { $avg: "$signalStrength" },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ];
  
  const data = await db.collection('measurements').aggregate(pipeline).toArray();
  
  // Calculate trend (simple linear regression)
  const trend = calculateTrendLine(data.map(d => d.avgSignal));
  
  return {
    data,
    trend: trend.slope > 0 ? 'improving' : 'declining',
    changeRate: trend.slope
  };
}
```

## 5. Analytics & Serving Layer

### Query Optimization

**Result Caching**:
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute TTL

async function getCachedHeatmap(params) {
  const cacheKey = `heatmap:${JSON.stringify(params)}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  // Generate fresh data
  const data = await generateHeatmapData(params);
  
  // Store in cache
  cache.set(cacheKey, data);
  
  return data;
}
```

**Pagination**:
```javascript
async function getPaginatedMeasurements(filters, page = 1, limit = 100) {
  const skip = (page - 1) * limit;
  
  const [measurements, total] = await Promise.all([
    db.collection('measurements')
      .find(filters)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection('measurements').countDocuments(filters)
  ]);
  
  return {
    measurements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}
```

### Data Transformation

**GeoJSON Conversion**:
```javascript
function toGeoJSON(measurements) {
  return {
    type: 'FeatureCollection',
    features: measurements.map(m => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [m.location.coordinates[0], m.location.coordinates[1]]
      },
      properties: {
        signalStrength: m.signalStrength,
        provider: m.provider,
        connectionType: m.connectionType,
        timestamp: m.timestamp
      }
    }))
  };
}
```

## Performance Considerations

### Database Optimization
- Use appropriate indexes for common queries
- Leverage MongoDB aggregation framework
- Implement query result caching
- Regular index maintenance

### Parallel Processing
- Process batch uploads in parallel
- Use worker threads for CPU-intensive aggregations
- Implement job queues (Bull/BullMQ) for async processing

### Memory Management
- Stream large result sets
- Implement pagination for all list endpoints
- Clear cached data regularly
- Monitor memory usage

### Data Archival
- Move old measurements to cold storage
- Maintain only aggregated data for historical periods
- Implement automated cleanup jobs

## Error Handling

### Validation Errors
- Log rejected measurements with reasons
- Provide detailed error messages to clients
- Implement retry logic with backoff

### Processing Errors
- Dead letter queue for failed jobs
- Alerting for processing bottlenecks
- Graceful degradation (serve cached data)

## Monitoring

### Key Metrics
- Ingestion rate (measurements/second)
- Processing latency
- Error rate
- Cache hit ratio
- Query response times

### Dashboards
- Real-time data flow monitoring
- Data quality metrics
- System performance metrics
- Anomaly detection alerts

## Related Documentation
- [System Design](system-design.md)
- [Database Schema](database-schema.md)
- [Performance](performance.md)
- [API Specification](api-specification.md)
