# Performance

## Overview

This document outlines performance requirements, optimization strategies, and monitoring approaches for the Network Analyser system.

## Performance Requirements

### API Response Times

| Endpoint Type | Target | Maximum |
|--------------|--------|---------|
| Simple queries (by ID) | < 100ms | < 200ms |
| Geospatial queries | < 200ms | < 500ms |
| Aggregations (cached) | < 200ms | < 500ms |
| Aggregations (uncached) | < 1s | < 2s |
| Batch submissions | < 500ms | < 1s |

### Frontend Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| Time to First Byte (TTFB) | < 200ms | < 500ms |
| First Contentful Paint (FCP) | < 1.5s | < 2.5s |
| Largest Contentful Paint (LCP) | < 2.5s | < 4s |
| Time to Interactive (TTI) | < 3s | < 5s |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.25 |
| First Input Delay (FID) | < 100ms | < 300ms |

### Mobile App Performance

| Metric | Target |
|--------|--------|
| App launch time | < 2s |
| GPS fix time | < 5s |
| Measurement submission | < 1s |
| Battery drain (active tracking) | < 5% per hour |
| Memory usage | < 100MB |

### Database Performance

| Operation | Target | Maximum |
|-----------|--------|---------|
| Single insert | < 10ms | < 50ms |
| Batch insert (100 docs) | < 100ms | < 500ms |
| Geospatial query (within radius) | < 50ms | < 200ms |
| Aggregation pipeline | < 500ms | < 2s |
| Index scan | < 20ms | < 100ms |

## Backend Optimizations

### Database Indexing

**Critical Indexes**:
```javascript
// Geospatial index for location queries
db.measurements.createIndex({ location: "2dsphere" });

// Compound index for provider + time queries
db.measurements.createIndex({ provider: 1, timestamp: -1 });

// Covering index for common queries
db.measurements.createIndex({ 
  provider: 1, 
  timestamp: -1, 
  signalStrength: 1 
});
```

**Index Performance Monitoring**:
```javascript
// Check index usage
db.measurements.aggregate([
  { $indexStats: {} }
]);

// Explain query execution
db.measurements.find({ provider: "Verizon" })
  .explain("executionStats");
```

### Query Optimization

**Avoid Full Collection Scans**:
```javascript
// BAD: No index usage
db.measurements.find({ 
  "deviceInfo.platform": "iOS" 
});

// GOOD: Use indexed field first
db.measurements.find({ 
  provider: "Verizon",
  "deviceInfo.platform": "iOS" 
});
```

**Limit Result Sets**:
```javascript
// Always use limit and pagination
db.measurements.find(query)
  .limit(100)
  .skip(page * 100);

// Use projection to return only needed fields
db.measurements.find(query, { 
  signalStrength: 1, 
  location: 1, 
  timestamp: 1 
});
```

**Optimize Aggregation Pipelines**:
```javascript
// Place $match as early as possible
db.measurements.aggregate([
  // Filter first (uses index)
  { $match: { provider: "Verizon", timestamp: { $gte: lastWeek } } },
  
  // Then transform
  { $group: { _id: "$connectionType", avg: { $avg: "$signalStrength" } } },
  
  // Sort last
  { $sort: { avg: -1 } }
]);
```

### Caching Strategy

**Redis Integration**:
```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

async function getCachedData(key, fetchFunction, ttl = 300) {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch fresh data
  const data = await fetchFunction();
  
  // Store in cache
  await redis.setex(key, ttl, JSON.stringify(data));
  
  return data;
}

// Usage
app.get('/api/v1/analytics/providers', async (req, res) => {
  const { lat, lng, radius } = req.query;
  const cacheKey = `providers:${lat}:${lng}:${radius}`;
  
  const data = await getCachedData(
    cacheKey,
    () => calculateProviderStats({ lat, lng }, radius),
    300 // 5 minutes
  );
  
  res.json(data);
});
```

**Cache Invalidation**:
```javascript
// Invalidate on new data
app.post('/api/v1/measurements', async (req, res) => {
  await storeMeasurement(req.body);
  
  // Invalidate relevant caches
  const pattern = `providers:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  
  res.status(201).json({ success: true });
});
```

**HTTP Caching**:
```javascript
// Set cache headers
app.get('/api/v1/analytics/*', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
  next();
});

// ETags for conditional requests
app.use((req, res, next) => {
  const etag = generateETag(res.body);
  res.set('ETag', etag);
  
  if (req.header('If-None-Match') === etag) {
    res.status(304).end();
  } else {
    next();
  }
});
```

### Connection Pooling

**MongoDB Connection Pool**:
```javascript
const MongoClient = require('mongodb').MongoClient;

const client = new MongoClient(process.env.MONGODB_URI, {
  maxPoolSize: 50,        // Max connections
  minPoolSize: 10,        // Min connections
  maxIdleTimeMS: 30000,   // Close connections idle for 30s
  waitQueueTimeoutMS: 5000 // Timeout for waiting for connection
});
```

### Batch Processing

**Process Multiple Items Efficiently**:
```javascript
app.post('/api/v1/measurements/batch', async (req, res) => {
  const { measurements } = req.body;
  
  // Process in parallel with concurrency limit
  const results = await pLimit(10)(
    measurements.map(m => () => processMeasurement(m))
  );
  
  res.json({ processed: results.length });
});
```

## Frontend Optimizations

### Code Splitting

```javascript
// React lazy loading
const Dashboard = lazy(() => import('./pages/Dashboard'));
const HeatmapView = lazy(() => import('./pages/HeatmapView'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/heatmap" element={<HeatmapView />} />
      </Routes>
    </Suspense>
  );
}
```

### Bundle Optimization

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'maps': ['mapbox-gl', 'react-map-gl'],
          'charts': ['recharts', 'd3']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

### Image Optimization

```javascript
// Use modern formats
<picture>
  <source srcset="heatmap.webp" type="image/webp" />
  <source srcset="heatmap.jpg" type="image/jpeg" />
  <img src="heatmap.jpg" alt="Heatmap" loading="lazy" />
</picture>

// Responsive images
<img 
  srcset="map-320w.jpg 320w,
          map-640w.jpg 640w,
          map-1280w.jpg 1280w"
  sizes="(max-width: 640px) 320px,
         (max-width: 1280px) 640px,
         1280px"
  src="map-640w.jpg"
  alt="Network map"
/>
```

### Component Memoization

```javascript
// React.memo for expensive components
const HeatmapLayer = memo(({ data, provider }) => {
  // Expensive rendering logic
  return <MapLayer data={data} />;
}, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data && 
         prevProps.provider === nextProps.provider;
});

// useMemo for expensive calculations
const processedData = useMemo(() => {
  return data.map(item => ({
    ...item,
    normalized: normalizeSignalStrength(item.signalStrength)
  }));
}, [data]);

// useCallback for stable function references
const handleMarkerClick = useCallback((marker) => {
  setSelectedMarker(marker);
}, []);
```

### Virtual Scrolling

```javascript
// For large lists
import { FixedSizeList } from 'react-window';

function MeasurementList({ measurements }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {measurements[index].signalStrength} dBm
    </div>
  );
  
  return (
    <FixedSizeList
      height={600}
      itemCount={measurements.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

### API Request Optimization

**Debouncing**:
```javascript
const debouncedSearch = useMemo(
  () => debounce((value) => {
    fetchMeasurements(value);
  }, 500),
  []
);
```

**Request Deduplication**:
```javascript
// React Query automatically deduplicates
const { data } = useQuery({
  queryKey: ['measurements', location],
  queryFn: () => fetchMeasurements(location),
  staleTime: 60000 // Don't refetch for 60s
});
```

**Pagination**:
```javascript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['measurements'],
  queryFn: ({ pageParam = 0 }) => 
    fetchMeasurements({ offset: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextOffset
});
```

## Map Performance

### Tile Optimization

```javascript
// Use vector tiles instead of raster
<Map
  mapStyle="mapbox://styles/mapbox/dark-v10"
  mapboxAccessToken={token}
/>

// Limit tile loading
<Map
  maxBounds={[[-180, -85], [180, 85]]}
  minZoom={2}
  maxZoom={18}
/>
```

### Clustering

```javascript
// Cluster markers at lower zoom levels
import Supercluster from 'supercluster';

const cluster = new Supercluster({
  radius: 40,
  maxZoom: 16
});

cluster.load(measurements.map(m => ({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [m.longitude, m.latitude]
  },
  properties: { signalStrength: m.signalStrength }
})));

const clusters = cluster.getClusters(bounds, zoom);
```

### Viewport-Based Loading

```javascript
// Only load data for visible area
const [viewport, setViewport] = useState({
  latitude: 37.7749,
  longitude: -122.4194,
  zoom: 10
});

const { data } = useQuery({
  queryKey: ['heatmap', viewport],
  queryFn: () => fetchHeatmapData({
    bounds: viewport.bounds,
    zoom: viewport.zoom
  }),
  enabled: !!viewport.bounds
});
```

## Mobile App Performance

### Battery Optimization

```javascript
// Adaptive sampling based on movement
class LocationService {
  private isMoving = false;
  
  async startTracking() {
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: this.isMoving ? 30000 : 60000, // More frequent when moving
        distanceInterval: 50
      },
      this.handleLocation
    );
  }
  
  handleLocation = (location) => {
    // Detect movement
    if (location.coords.speed > 1) { // > 1 m/s
      this.isMoving = true;
    } else {
      this.isMoving = false;
    }
  };
}
```

### Memory Management

```javascript
// Clean up listeners
useEffect(() => {
  const subscription = locationService.subscribe(handleLocation);
  
  return () => {
    subscription.remove();
  };
}, []);

// Limit history storage
const MAX_HISTORY_ITEMS = 100;

function addToHistory(item) {
  const history = [...state.history, item];
  if (history.length > MAX_HISTORY_ITEMS) {
    history.shift();
  }
  return history;
}
```

### Network Efficiency

```javascript
// Batch API requests
const queue = [];
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 30000; // 30 seconds

function queueMeasurement(measurement) {
  queue.push(measurement);
  
  if (queue.length >= BATCH_SIZE) {
    submitBatch();
  }
}

setInterval(() => {
  if (queue.length > 0) {
    submitBatch();
  }
}, BATCH_INTERVAL);
```

## Load Testing Results

### Baseline Performance

**Test Setup**:
- Server: 2 CPU, 4GB RAM
- Database: MongoDB Atlas M10
- Load: 100 concurrent users

**Results**:
```
Scenario: Submit measurement
Duration: 300s
Requests/sec: 250
Response time (p50): 45ms
Response time (p95): 120ms
Response time (p99): 280ms
Errors: 0.02%
```

**Test Setup**:
- Load: 500 concurrent users

**Results**:
```
Scenario: Get heatmap data
Duration: 300s
Requests/sec: 150
Response time (p50): 180ms
Response time (p95): 450ms
Response time (p99): 890ms
Errors: 0.5%
```

### Optimizations Applied

1. **Added Redis caching**: 40% reduction in response time
2. **Optimized aggregation pipeline**: 30% faster queries
3. **Added indexes**: 50% reduction in query time
4. **Increased connection pool**: Handle 2x more concurrent requests

## Monitoring

### Key Performance Indicators

```javascript
// Custom metrics
const metrics = {
  apiResponseTime: new Histogram(),
  dbQueryTime: new Histogram(),
  cacheHitRate: new Counter(),
  errorRate: new Counter()
};

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.apiResponseTime.observe(duration);
    
    if (res.statusCode >= 500) {
      metrics.errorRate.inc();
    }
  });
  
  next();
});
```

### Performance Dashboard

**Key Metrics to Monitor**:
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Error rate (%)
- Cache hit ratio (%)
- Database connection pool usage
- Memory usage
- CPU usage

### Alerts

**Performance Degradation**:
- Alert when p95 response time > 1s
- Alert when error rate > 1%
- Alert when cache hit ratio < 70%
- Alert when CPU > 80% for 5 minutes

## Performance Checklist

### Backend
- [ ] Database indexes for all common queries
- [ ] Connection pooling configured
- [ ] Caching implemented (Redis)
- [ ] Query result pagination
- [ ] Rate limiting active
- [ ] Compression enabled (gzip)
- [ ] Keep-alive connections

### Frontend
- [ ] Code splitting implemented
- [ ] Images optimized and lazy loaded
- [ ] Bundle size < 500KB (gzipped)
- [ ] Critical CSS inlined
- [ ] CDN for static assets
- [ ] Service worker for offline support
- [ ] Web Vitals within targets

### Mobile
- [ ] Background processing optimized
- [ ] Battery drain < 5% per hour
- [ ] Memory usage < 100MB
- [ ] Offline queue implemented
- [ ] Request batching active
- [ ] Image caching enabled

### Database
- [ ] Indexes cover 95% of queries
- [ ] Slow query logging enabled
- [ ] Connection pool sized appropriately
- [ ] Sharding strategy defined
- [ ] Backup doesn't impact performance

## Related Documentation
- [System Design](system-design.md)
- [Database Schema](database-schema.md)
- [Testing](testing.md)
- [Deployment](deployment.md)
