# System Architecture

## Overview

The Network Analyser system follows a multi-tier, service-oriented architecture designed for scalability, maintainability, and real-time data processing capabilities.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────────┐              ┌───────────────────┐   │
│  │  Mobile App      │              │  Web Dashboard    │   │
│  │  (React Native)  │              │  (React)          │   │
│  └──────────────────┘              └───────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
│                   (Express.js Server)                        │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Data        │  │  Analytics   │  │  Admin       │
│  Collection  │  │  Services    │  │  Services    │
│  Service     │  │              │  │              │
└──────────────┘  └──────┬───────┘  └──────────────┘
        │                │                  │
        │                └──────┐           │
        │                       ▼           │
        │           ┌────────────────────┐  │
        │           │  Caching Layer     │  │
        │           │  (Redis)           │  │
        │           │  • 5-min TTL       │  │
        │           │  • Query results   │  │
        │           └────────────────────┘  │
        │                       │           │
        └───────────────────────┼───────────┘
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Persistence Layer                      │
│                     MongoDB Atlas                            │
│  ┌────────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │  NetworkData   │  │  Reports    │  │  Users/Config  │  │
│  │  Collection    │  │  Collection │  │  Collections   │  │
│  │  • Geohash     │  │             │  │                │  │
│  │  • 2dsphere    │  │             │  │                │  │
│  └────────────────┘  └─────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Architecture Layers

### 1. Client Layer

**Mobile Application (React Native)**
- Responsible for data acquisition
- Collects signal strength, GPS coordinates, and network metadata
- Uploads measurements to the backend API
- Minimal local processing to conserve battery

**Web Dashboard (React)**
- Provides visualization and analytics interface
- Renders geospatial heatmaps
- Displays aggregated statistics
- Administrative control panel

### 2. API Layer

**Express.js REST API**
- Validates incoming requests
- Implements business logic
- Routes requests to appropriate services
- Handles authentication and authorization
- Returns standardized JSON responses

### 3. Service Layer

**Data Collection Service**
- Receives measurements from mobile clients
- Validates data integrity
- Generates geohash (precision 6, ~1.2km) for spatial clustering
- Enriches data with metadata (timestamp, GeoJSON location, etc.)
- Persists to database

**Analytics Service**
- Aggregates measurements by region, provider, time
- Computes statistical metrics (avg, min, max, percentiles)
- Generates heatmap data (raw and geohash-clustered)
- Processes geospatial queries with $geoNear
- Determines best providers by location
- Implements Redis caching layer (5-minute TTL)

**Admin Service**
- Manages system configuration
- Handles user management
- Provides data moderation capabilities
- System health monitoring

### 4. Caching Layer

**Redis Cache**
- In-memory key-value store
- 5-minute TTL (Time To Live) for all cached queries
- Cache keys based on query parameters
- Automatic expiration and invalidation
- Falls back to MongoDB if Redis unavailable
- Improves response time by 10-50x for repeated queries

**Cached Endpoints:**
- `GET /api/networks/heatmap` - Detailed measurements
- `GET /api/networks/heatmap/aggregated` - Geohash clusters
- `GET /api/networks/best` - Provider rankings by location

**Cache Strategy:**
```
Request → Check Redis → If hit: Return cached
                      → If miss: Query MongoDB → Cache result → Return
```

### 5. Data Layer

**MongoDB Database**
- Document-based storage
- Geospatial indexing (2dsphere) on location field
- Geohash indexing for clustering queries
- Aggregation pipeline support
- High write throughput for incoming measurements

**Collections:**
- `networkdata` - Network signal measurements with geohash
- `reports` - User-submitted outage reports
- `users` - User accounts and configuration

## Architecture Principles

### Separation of Concerns
Each layer has distinct responsibilities, enabling independent development and testing.

### Scalability
- Horizontal scaling of API servers
- Database sharding by geographic region
- CDN for static web assets

### Extensibility
Modular service design allows adding new features (e.g., ML-based anomaly detection) without architectural changes.

### Data-Driven
All decisions based on collected metrics, with aggregation pipelines optimized for analytical queries.

### Cloud-Native
Designed for deployment on cloud platforms with managed services (MongoDB Atlas, Vercel, etc.).

## Communication Patterns

### Synchronous (REST API)
- Mobile app → Backend (data submission)
- Web dashboard → Backend (data retrieval)
- Request-response pattern

### Asynchronous (Future Enhancement)
- WebSocket connections for real-time updates
- Message queue for background processing
- Event-driven notifications

## Related Documentation
- [System Design](system-design.md) - Detailed component design
- [Mobile Architecture](mobile-architecture.md) - Mobile app specifics
- [Web Architecture](web-architecture.md) - Web dashboard specifics
- [Data Processing](data-processing.md) - Data flow and processing logic
