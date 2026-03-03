# Limitations and Known Issues

## Overview

This document outlines the current limitations, known issues, and planned improvements for the Network Analyser system.

## Technical Limitations

### Mobile Platform Constraints

#### Signal Strength Access

**iOS Limitations**:
- No public API to access cellular signal strength
- Core Telephony framework provides limited information
- Only available through private APIs (not allowed in App Store)
- Workaround: Use Core Telephony's signal bars (0-5) as proxy

**Android Limitations**:
- Signal strength API requires `READ_PHONE_STATE` permission
- Some manufacturers restrict access to detailed network info
- API behavior varies across Android versions
- Different signal strength units (dBm, ASU, bars)

**Current Approach**:
```javascript
// iOS: Limited data available
import * as Network from 'expo-network';
// Only provides connection type, not signal strength

// Android: More data available but requires permissions
// Can access signal strength via native modules

// Workaround: Rely on user-reported measurements
// or WiFi signal strength as proxy in some cases
```

#### GPS Accuracy

**Challenges**:
- Indoor locations have poor GPS accuracy (50-100m typical)
- Urban canyons cause multipath errors
- Battery drain with continuous high-accuracy tracking
- GPS fix time can be slow (5-10 seconds)

**Mitigation**:
```javascript
// Filter measurements with poor accuracy
if (location.coords.accuracy > 100) {
  // Reject or flag as low-confidence
  return;
}

// Use cell tower / WiFi positioning as fallback
```

#### Background Limitations

**iOS Background Restrictions**:
- Limited background execution time (3 minutes after app backgrounds)
- Background location updates drain battery significantly
- Must use "always" location permission (harder to get user approval)
- App may be terminated after prolonged background use

**Android Background Restrictions** (Android 8+):
- Doze mode limits background processing
- Background location access restricted
- Requires foreground service with persistent notification
- Battery optimization can kill app

**Impact**:
- Cannot collect measurements continuously in background
- Must balance data collection frequency with battery life
- User must keep app in foreground for optimal data collection

### Database Limitations

#### Geospatial Query Constraints

**MongoDB 2dsphere Index**:
- Maximum index size: 16MB per document
- Complex polygons can be slow to query
- $near queries limited to 100 results by default
- Precision limited to ~1 meter at equator

**Scalability Concerns**:
- Large datasets (millions of points) can slow queries
- Aggregation pipelines memory limit: 100MB by default
- Index maintenance overhead grows with data volume

**Workaround**:
```javascript
// Use geohashing for very large datasets
const geohash = encodeGeohash(lat, lng, precision);
db.measurements.createIndex({ geohash: 1, timestamp: -1 });

// Pre-aggregate data by region
db.aggregations.find({ region: geohash.substring(0, 4) });
```

#### Data Volume

**Current Capacity**:
- Expected growth: ~1M measurements/month
- Raw data retention: 90 days = ~3M documents
- Aggregated data: 2 years = ~24 months

**Scaling Challenges**:
- Query performance degrades with >10M documents
- Backup/restore time increases linearly
- Index size grows, affecting memory usage

**Future Solutions**:
- Implement time-series collections (MongoDB 5.0+)
- Archive old data to cold storage
- Shard by geographic region + time

### API Limitations

#### Rate Limiting

**Current Limits**:
- Mobile clients: 100 requests/minute (may be too restrictive)
- Web dashboard: 500 requests/minute
- Batch endpoint: 10 requests/minute

**Issues**:
- Legitimate high-frequency use cases may hit limits
- No distinction between read and write operations
- IP-based limiting can block multiple users behind NAT

**Planned Improvements**:
- Per-user rate limiting with API keys
- Separate limits for different endpoint types
- Burst capacity for temporary spikes

#### Real-Time Updates

**Current Limitation**:
- No WebSocket or Server-Sent Events support
- Clients must poll for updates
- Delays in data availability (cache TTL)

**Impact**:
- Dashboard not truly "real-time"
- Higher server load from polling
- Increased latency for time-sensitive features

**Planned Enhancement**:
```javascript
// WebSocket support for live updates
io.on('connection', (socket) => {
  socket.on('subscribe:region', (bounds) => {
    // Stream new measurements for region
  });
});
```

#### Pagination

**Current Issues**:
- Offset-based pagination doesn't scale well
- Inconsistent results if data changes between pages
- No cursor-based pagination

**Better Approach**:
```javascript
// Cursor-based pagination
{
  measurements: [...],
  nextCursor: "eyJpZCI6IjY1ZjNhMWIyIn0=",
  hasMore: true
}
```

### Map Visualization Limitations

#### Heatmap Performance

**Challenges**:
- Large datasets (>10,000 points) slow rendering
- Mobile devices struggle with complex map layers
- Zoom-level transitions can be janky

**Current Optimizations**:
- Viewport-based data loading
- Clustering at low zoom levels
- Tile-based rendering

**Known Issues**:
- Heatmap color scale may not be intuitive
- Overlapping markers hard to distinguish
- No 3D visualization

#### Coverage Holes

**Problem**:
- Sparse data in rural areas
- Overrepresentation of urban corridors
- No measurements in areas without users

**Impact**:
- Heatmap shows incomplete picture
- Provider comparisons biased toward populated areas
- Difficult to identify true coverage gaps

**Mitigation**:
- Show confidence levels based on sample size
- Highlight regions with insufficient data
- Encourage targeted data collection campaigns

### Mobile App Limitations

#### Platform Discrepancies

**iOS vs Android Differences**:
- Different data available from network APIs
- Varying location accuracy
- Background behavior inconsistencies
- Permission models differ

**Impact**:
- Feature parity difficult to maintain
- Data quality varies by platform
- User experience not identical

#### Battery Drain

**Current Performance**:
- Active tracking: ~5% battery per hour (target)
- Actual varies by device and usage pattern
- Background tracking much higher drain

**User Complaints**:
- Some users report excessive battery usage
- Tracking must be manually disabled
- No adaptive battery optimization

**Planned Improvements**:
- Intelligent tracking (only when moving)
- Configurable sampling intervals
- Better battery usage reporting

#### Offline Support

**Current Capabilities**:
- Queue measurements when offline
- Sync when connection restored
- No offline map tiles

**Limitations**:
- Queue size limited to 1000 items
- No conflict resolution for duplicate submissions
- Map requires internet connection

### Data Quality Issues

#### User-Generated Data Problems

**Known Issues**:
- Fake/spam submissions
- Incorrect provider identification
- GPS spoofing
- Duplicate measurements

**Detection Mechanisms**:
```javascript
// Anomaly detection
- Impossible travel speed
- Identical coordinates from different users
- Signal strength outside feasible range
- Excessive submission rate
```

**Limitations**:
- No perfect spam detection
- Manual review required for edge cases
- False positives possible

#### Measurement Accuracy

**Factors Affecting Accuracy**:
- GPS accuracy varies (5-100m typical)
- Signal strength fluctuates rapidly
- Provider name may be incorrect (MVNO vs parent network)
- Connection type misidentification

**Data Confidence Scoring**:
```javascript
function calculateConfidence(measurement) {
  let score = 100;
  
  if (measurement.gpsAccuracy > 50) score -= 20;
  if (measurement.signalStrength === -1) score -= 30;
  if (!measurement.provider) score -= 40;
  
  return Math.max(0, score);
}
```

### Security Limitations

#### Privacy Concerns

**Location Data Sensitivity**:
- Precise GPS coordinates are personally identifiable
- Location history can reveal user patterns
- Potential for abuse or surveillance

**Current Protections**:
- No personally identifiable information collected (basic version)
- Location data aggregated for visualization
- Data retention limited to 90 days

**Should Consider**:
- Optional location fuzzing (±100m random offset)
- Differential privacy for aggregations
- User control over data sharing

#### Authentication

**Current State**:
- API key authentication for mobile apps
- No OAuth or SSO support
- No multi-factor authentication

**Limitations**:
- API keys can be extracted from app binary
- No fine-grained permissions
- Key rotation requires app update

### Web Dashboard Limitations

#### Browser Compatibility

**Tested Browsers**:
- Chrome 100+ ✓
- Firefox 100+ ✓
- Safari 15+ ✓
- Edge 100+ ✓

**Known Issues**:
- Map rendering issues on older iOS Safari
- WebGL not available on some browsers
- Performance issues on low-end devices

#### Mobile Responsiveness

**Current State**:
- Basic responsive design implemented
- Mobile-optimized but not mobile-first

**Issues**:
- Map controls too small on mobile
- Charts difficult to read on small screens
- No touch-optimized interactions

### Analytics Limitations

#### Statistical Limitations

**Current Metrics**:
- Simple average signal strength
- Min/max values
- Count of measurements

**Missing Analytics**:
- Confidence intervals
- Statistical significance testing
- Trend analysis with forecasting
- Outlier detection and removal

#### Time-Series Analysis

**Limitations**:
- Aggregations by fixed intervals only (hour, day, week)
- No moving averages or smoothing
- Limited historical trend visualization
- No anomaly detection for outages

## Known Bugs

### High Priority

1. **Race condition in batch processing** (Backend)
   - Duplicate measurements when submitting same data quickly
   - Workaround: Add unique constraint on coordinates + timestamp

2. **Map not updating after provider filter change** (Web)
   - React Query cache not invalidating properly
   - Status: In progress

3. **Background location stops after 30 minutes** (iOS)
   - iOS terminates app despite background mode enabled
   - No current workaround

### Medium Priority

1. **Incorrect provider names for MVNOs**
   - Carrier.getName() returns parent network
   - Need MVNO detection logic

2. **Slow aggregation queries on large datasets**
   - Queries timeout when >1M measurements in range
   - Need better indexing strategy

3. **Memory leak in map component**
   - Map layers not properly cleaned up
   - Observable after 10+ minutes of use

### Low Priority

1. **Inconsistent date formatting**
   - Mix of formats across UI
   - Cosmetic issue

2. **Missing error messages for some API failures**
   - Generic "Something went wrong"
   - Need better error codes

## Planned Improvements

### Short-Term (Next 3 Months)

- [ ] Implement WebSocket for real-time updates
- [ ] Add confidence scoring to measurements
- [ ] Improve battery optimization in mobile app
- [ ] Cursor-based pagination for API
- [ ] Better spam detection algorithms

### Medium-Term (3-6 Months)

- [ ] Time-series database migration
- [ ] Machine learning for anomaly detection
- [ ] Advanced analytics (trends, forecasting)
- [ ] Multi-region deployment
- [ ] OAuth authentication

### Long-Term (6-12 Months)

- [ ] Coverage prediction using ML
- [ ] Integration with telecom APIs (if available)
- [ ] Crowdsourced outage detection
- [ ] Public API for third-party integrations
- [ ] Mobile app widgets

## Workarounds

### For Users

**Battery Drain**:
- Manually stop tracking when not needed
- Increase sampling interval in settings
- Use WiFi-only mode when available

**GPS Inaccuracy**:
- Wait for good GPS fix before starting tracking
- Avoid indoor measurements
- Report location accuracy in submission

**Slow Dashboard**:
- Use smaller date ranges
- Filter by specific provider
- Reduce map zoom level for overview

### For Developers

**Slow Queries**:
```javascript
// Use aggregations collection instead of raw data
const stats = await db.collection('aggregations')
  .find({ 
    aggregationType: 'hourly',
    provider: 'Verizon',
    period: { $gte: startDate, $lte: endDate }
  });
```

**Memory Issues**:
```javascript
// Stream large result sets
const cursor = db.collection('measurements').find(query);
for await (const doc of cursor) {
  process(doc);
}
```

## Feature Requests

**Most Requested**:
1. Offline map support (145 votes)
2. Speed test integration (132 votes)
3. Historical comparison view (89 votes)
4. Export data as CSV (76 votes)
5. Notification for outages in area (54 votes)

## Contributing

Found a bug or have a feature request? 

- **Report bugs**: [GitHub Issues](https://github.com/network-analyser/issues)
- **Feature requests**: [GitHub Discussions](https://github.com/network-analyser/discussions)
- **Documentation updates**: Submit PR to docs/ folder

## Related Documentation
- [System Design](system-design.md)
- [Testing](testing.md)
- [Performance](performance.md)
- [Security](security.md)
