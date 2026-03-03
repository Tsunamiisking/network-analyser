# Network Analyser with Geo Map

## Project Overview

The **Network Analyser with Geo Map** is a distributed, crowdsourced network monitoring system designed to collect, process, and visualize mobile network performance data in real time. It provides transparency into cellular network quality through community-driven data collection and sophisticated analytics.

### Vision

Enable users to make informed decisions about mobile network providers through crowdsourced, geospatial network performance data.

### Key Objectives

- **Transparency**: Provide publicly accessible network performance metrics
- **Crowdsourcing**: Leverage community contributions for comprehensive coverage
- **Real-Time Insights**: Deliver up-to-date network quality information
- **Geographic Granularity**: Offer location-specific performance data

---

## Problem Statement

Mobile network performance varies significantly across geographic regions, yet there's limited publicly accessible, granular performance data. Users typically rely on:

- Anecdotal experiences
- Marketing claims from providers
- Outdated coverage maps
- Word-of-mouth recommendations

**Our Solution** addresses this gap by implementing a crowdsourced monitoring system that:

✅ Collects signal strength and network metadata from real users  
✅ Associates measurements with precise geospatial coordinates  
✅ Aggregates and analyzes network performance patterns  
✅ Visualizes data through interactive heatmaps and dashboards  
✅ Enables provider comparisons based on actual performance

---

## System Architecture

The system follows a **multi-tier, service-oriented architecture**:

```
┌──────────────────────────────────────────────────────┐
│              Client Applications                      │
│  ┌─────────────────┐      ┌────────────────────┐   │
│  │  Mobile App     │      │  Web Dashboard     │   │
│  │  (React Native) │      │  (React)           │   │
│  └─────────────────┘      └────────────────────┘   │
└──────────────────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                      ▼
┌─────────────────────────────────────────────────────┐
│              Backend API Layer                       │
│            (Node.js + Express)                       │
│  • REST API Endpoints                               │
│  • Authentication & Rate Limiting                   │
│  • Data Validation & Processing                     │
└─────────────────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│  MongoDB Atlas   │   │  Redis Cache     │
│  • Measurements  │   │  • Query Cache   │
│  • Aggregations  │   │  • Rate Limits   │
│  • Geospatial    │   └──────────────────┘
└──────────────────┘
```

### Architecture Layers

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Data Acquisition** | React Native (Expo) | Collect signal strength, GPS, network metadata |
| **API & Processing** | Node.js + Express | Validate, process, route requests |
| **Data Persistence** | MongoDB Atlas | Store measurements, support geospatial queries |
| **Caching** | Redis | Cache aggregations, manage rate limits |
| **Visualization** | React + Mapbox GL | Render heatmaps, analytics, dashboards |

📖 **Learn More**: [Architecture Details](architecture.md) | [System Design](system-design.md)

---

## Core Features

### 1. Mobile Data Collection
- Continuous or on-demand signal strength monitoring
- GPS coordinate capture with accuracy filtering
- Network provider and connection type identification
- Offline queue with automatic sync
- Battery-optimized background operation

### 2. Real-Time Heatmap
- Color-coded signal strength visualization
- Dynamic clustering for performance
- Provider-specific filtering
- Time-range selection
- Responsive map controls

### 3. Analytics Dashboard
- Provider performance comparisons
- Time-series trend analysis
- Statistical metrics (avg, min, max, percentiles)
- Coverage area analysis
- Connection type distribution

### 4. Outage Tracking
- Manual outage reporting
- Geographic outage visualization
- Severity classification
- Community confirmation system
- Historical outage data

### 5. Administrative Controls
- System statistics monitoring
- Data quality oversight
- User management (planned)
- API usage tracking

📖 **Learn More**: [Mobile Architecture](mobile-architecture.md) | [Web Architecture](web-architecture.md)

---

## Technology Stack

### Mobile Application
- **Framework**: React Native with Expo
- **Location**: expo-location (GPS)
- **State Management**: Redux Toolkit
- **API Client**: Axios
- **Storage**: Expo SecureStore

### Backend API
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **ODM**: Mongoose
- **Authentication**: JWT + API Keys
- **Validation**: Joi
- **Security**: Helmet + Rate Limiting

### Web Dashboard
- **Framework**: React 18+
- **Build Tool**: Vite
- **State Management**: React Query + Context
- **Maps**: Mapbox GL JS
- **Charts**: Recharts
- **Styling**: Tailwind CSS (recommended)

### Database
- **Primary**: MongoDB Atlas
- **Indexing**: 2dsphere (geospatial)
- **Aggregations**: MongoDB Aggregation Framework
- **Backup**: Automated (MongoDB Atlas)

### Infrastructure
- **Backend Hosting**: Render / Railway / Fly.io
- **Web Hosting**: Vercel
- **Database**: MongoDB Atlas (managed)
- **Cache**: Redis (optional, for scaling)
- **CDN**: Cloudflare / Vercel Edge
- **Mobile Distribution**: App Store + Google Play

📖 **Learn More**: [Deployment Guide](deployment.md)

---

## Key Technical Decisions

### Why MongoDB?
- Native geospatial query support (2dsphere indexing)
- Flexible schema for evolving requirements
- Powerful aggregation framework
- Horizontal scalability through sharding

### Why React Native?
- Single codebase for iOS and Android
- Rich ecosystem (Expo)
- Native performance for GPS and network APIs
- Fast development iteration

### Why REST over GraphQL?
- Simpler caching strategy (HTTP caching)
- Standardized tooling and documentation
- Lower learning curve
- Sufficient for current requirements

### Why Serverless-Ready?
- Cost-effective for variable traffic
- Automatic scaling
- Reduced operational overhead
- Pay-per-use pricing model

📖 **Learn More**: [System Design Rationale](system-design.md)

---

## Data Flow

### Measurement Collection Pipeline

```
1. Mobile App
   ↓ (Collects signal + GPS)
2. Local Buffer
   ↓ (Batch upload every 30s or 10 items)
3. Backend API
   ↓ (Validates, enriches, normalizes)
4. MongoDB
   ↓ (Indexed storage)
5. Aggregation Pipeline
   ↓ (Real-time stats)
6. Redis Cache
   ↓ (5-minute TTL)
7. Web Dashboard
   ↓ (Visualization)
8. User
```

### Query Flow

```
1. User requests heatmap data
   ↓
2. Check Redis cache
   ├─ HIT → Return cached data (fast)
   └─ MISS ↓
3. Execute MongoDB aggregation
   ↓
4. Store result in cache
   ↓
5. Return to client
```

📖 **Learn More**: [Data Processing Pipeline](data-processing.md)

---

## Security & Privacy

### Data Protection
- **Minimal data collection**: Only essential metrics
- **GPS accuracy filtering**: Remove low-quality data
- **IP address hashing**: Abuse detection only
- **Data retention**: 90 days for raw data, 2 years aggregated
- **Encryption**: TLS in transit, at rest in MongoDB

### Authentication & Authorization
- **Mobile**: API key authentication
- **Web**: JWT tokens with refresh
- **Admin**: Role-based access control
- **Rate limiting**: Per-client and per-endpoint

### GDPR Compliance
- Right to access exported data
- Right to erasure (delete account)
- Privacy-by-design approach
- Clear data retention policies

📖 **Learn More**: [Security Documentation](security.md)

---

## Performance Targets

| Metric | Target | Maximum |
|--------|--------|---------|
| API Response (simple) | < 100ms | < 200ms |
| API Response (aggregation) | < 500ms | < 2s |
| Web Page Load (LCP) | < 2.5s | < 4s |
| Mobile App Launch | < 2s | < 3s |
| Database Query | < 50ms | < 200ms |
| Heatmap Render | < 1s | < 2s |

📖 **Learn More**: [Performance Optimization](performance.md)

---

## Testing Strategy

### Test Coverage Goals
- **Unit Tests**: > 80% coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical user flows
- **Performance Tests**: Load and stress testing

### Testing Frameworks
- **Backend**: Jest + Supertest
- **Web**: Vitest + Testing Library + Playwright
- **Mobile**: Jest + Detox
- **Load Testing**: Artillery

📖 **Learn More**: [Testing Documentation](testing.md)

---

## Current Limitations

### Platform Constraints
- ⚠️ iOS doesn't provide public signal strength API
- ⚠️ Background location tracking limited on both platforms
- ⚠️ GPS accuracy varies (5-100m typical)
- ⚠️ Battery drain during continuous tracking

### Data Quality
- Crowdsourced data requires validation
- Coverage gaps in rural/unpopulated areas
- Provider identification can be inaccurate (MVNOs)
- Signal strength fluctuates rapidly

### Scalability
- Database performance degrades beyond 10M documents
- Real-time updates require WebSocket (planned)
- Map rendering slows with >10K points

📖 **Learn More**: [Limitations & Known Issues](limitations.md)

---

## Roadmap

### Phase 1: MVP (Current)
- [x] Basic mobile data collection
- [x] Backend API with geospatial queries
- [x] Web dashboard with heatmap
- [x] Provider comparison analytics

### Phase 2: Enhancement (3-6 months)
- [ ] WebSocket for real-time updates
- [ ] Advanced analytics (trends, forecasting)
- [ ] Improved spam detection
- [ ] Multi-region deployment
- [ ] OAuth authentication

### Phase 3: Scale (6-12 months)
- [ ] Machine learning for coverage prediction
- [ ] Integration with telecom APIs
- [ ] Public API for third parties
- [ ] Mobile app widgets
- [ ] Offline map support

---

## Documentation Index

### Getting Started
- [System Architecture](architecture.md) - High-level design and component overview
- [System Design](system-design.md) - Detailed design decisions and patterns

### Development
- [Mobile Architecture](mobile-architecture.md) - React Native app structure
- [Web Architecture](web-architecture.md) - React dashboard implementation
- [API Specification](api-specification.md) - REST API endpoints and contracts
- [Database Schema](database-schema.md) - MongoDB collections and indexes
- [Data Processing](data-processing.md) - Data pipeline and aggregations

### Operations
- [Deployment](deployment.md) - Infrastructure and CI/CD setup
- [Security](security.md) - Security measures and best practices
- [Performance](performance.md) - Optimization strategies and benchmarks
- [Testing](testing.md) - Test strategy and implementation

### Reference
- [Limitations](limitations.md) - Known issues and constraints

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Expo CLI
- Git

### Clone Repository
```bash
git clone https://github.com/your-org/network-analyser.git
cd network-analyser
```

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure MongoDB URI in .env
npm run dev
```

### Web Dashboard Setup
```bash
cd web-dashboard
npm install
cp .env.example .env
# Configure API URL in .env
npm run dev
```

### Mobile App Setup
```bash
cd mobile-app
npm install
cp .env.example .env
# Configure API URL in .env
expo start
```

---

## Contributing

We welcome contributions! Please see:
- [Contributing Guide](../CONTRIBUTING.md) (planned)
- [Code of Conduct](../CODE_OF_CONDUCT.md) (planned)
- [Issue Templates](../.github/ISSUE_TEMPLATE/) (planned)

---

## License

[MIT License](../LICENSE) - see LICENSE file for details

---

## Contact

- **Project Lead**: Allen Douglas
- **Email**: douglasallendev@gmail.com
- **GitHub**: [github.com/network-analyser](https://github.com/)
- **Documentation**: This repository

---

**Last Updated**: March 2026  
**Documentation Version**: 1.0