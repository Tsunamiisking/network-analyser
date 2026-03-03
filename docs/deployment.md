# Deployment

## Overview

The Network Analyser system is designed for cloud-native deployment with fully managed services to minimize operational overhead and maximize reliability.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│                                                          │
│  Mobile Apps (iOS/Android)    Web Dashboard             │
│  Expo EAS Distribution        Vercel CDN                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Load Balancer / CDN                     │
│                  Cloudflare or AWS                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend API                            │
│              Render / Railway / Fly.io                   │
│        (Auto-scaling, Health monitoring)                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Database Layer                         │
│                  MongoDB Atlas                           │
│     (Multi-region, Auto-backup, Scaling)                │
└─────────────────────────────────────────────────────────┘
```

## Component Deployment

### 1. Mobile Application

**Platform**: Expo Application Services (EAS)

**Build Configuration**:
```json
// eas.json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "distribution": "store",
      "env": {
        "API_URL": "https://api.network-analyser.com"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDE12345"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

**Build Commands**:
```bash
# Development build
eas build --profile development --platform all

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

**OTA Updates**:
```bash
# Push update to production
eas update --branch production --message "Bug fixes and improvements"

# Rollback if needed
eas update:republish --branch production --group <update-group-id>
```

**Distribution**:
- **iOS**: Apple App Store
- **Android**: Google Play Store
- **Internal Testing**: TestFlight (iOS), Internal Testing Track (Android)

---

### 2. Backend API

**Platform Options**:

#### Option A: Render
- ✅ Simple deployment from Git
- ✅ Automatic HTTPS
- ✅ Zero-downtime deployments
- ✅ Built-in health checks
- ⚠️ Limited geographic regions

#### Option B: Railway
- ✅ Easy scaling
- ✅ Built-in observability
- ✅ PostgreSQL/MongoDB support
- ⚠️ Higher cost at scale

#### Option C: Fly.io
- ✅ Multi-region deployment
- ✅ Low latency globally
- ✅ Fine-grained control
- ⚠️ Steeper learning curve

**Selected Platform**: Render (for simplicity)

**Deployment Configuration**:
```yaml
# render.yaml
services:
  - type: web
    name: network-analyser-api
    env: node
    region: oregon
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false  # Set via dashboard
      - key: API_KEY_SECRET
        sync: false
      - key: JWT_SECRET
        sync: false
    healthCheckPath: /health
    autoDeploy: true
    scaling:
      minInstances: 1
      maxInstances: 5
      targetCPUPercent: 70
```

**Environment Variables**:
```bash
# .env.production
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://...
API_KEY_SECRET=<generate-strong-key>
JWT_SECRET=<generate-strong-key>
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
CACHE_TTL=300
LOG_LEVEL=info
```

**Health Check Endpoint**:
```javascript
// backend/routes/health.js
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await db.admin().ping();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

**Deployment Process**:
```bash
# 1. Push to main branch
git push origin main

# 2. Render auto-deploys from GitHub
# Monitor at: https://dashboard.render.com

# 3. Verify deployment
curl https://api.network-analyser.com/health
```

---

### 3. Web Dashboard

**Platform**: Vercel

**Configuration**:
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "framework": "vite",
  "regions": ["iad1", "sfo1"],
  "env": {
    "VITE_API_URL": "https://api.network-analyser.com",
    "VITE_MAPBOX_TOKEN": "@mapbox_token"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.network-analyser.com/api/:path*"
    }
  ]
}
```

**Environment Variables** (via Vercel Dashboard):
```
VITE_API_URL=https://api.network-analyser.com
VITE_MAPBOX_TOKEN=<your-token>
VITE_GOOGLE_MAPS_KEY=<your-key>
```

**Deployment**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Or connect GitHub repo for auto-deployment
```

**Preview Deployments**:
- Every PR gets automatic preview deployment
- Test changes before merging
- Unique URL per PR

---

### 4. Database

**Platform**: MongoDB Atlas

**Configuration**:

**Cluster Setup**:
- **Tier**: M10 (Production) or M0 (Free tier for development)
- **Region**: Same as backend API (e.g., us-west-2)
- **Backup**: Continuous backup enabled
- **Monitoring**: Performance Advisor enabled

**Connection String**:
```
mongodb+srv://<username>:<password>@cluster0.mongodb.net/network-analyser?retryWrites=true&w=majority
```

**Network Access**:
- Whitelist backend API IP addresses
- Or allow access from anywhere (0.0.0.0/0) if using service mesh

**Database Users**:
```javascript
// Admin user (for migrations)
{
  username: "admin",
  roles: ["dbAdmin", "readWrite"]
}

// Application user (for backend)
{
  username: "app_user",
  roles: ["readWrite"]
}

// Analytics user (read-only)
{
  username: "analytics_user",
  roles: ["read"]
}
```

**Indexes** (created during initial setup):
```javascript
// Run via MongoDB shell or Atlas UI
use network-analyser;

db.measurements.createIndex({ location: "2dsphere" });
db.measurements.createIndex({ provider: 1, timestamp: -1 });
db.measurements.createIndex({ timestamp: -1 });
db.outages.createIndex({ location: "2dsphere" });
db.outages.createIndex({ provider: 1, status: 1 });
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm ci
      - name: Run tests
        run: cd backend && npm test
      - name: Lint
        run: cd backend && npm run lint

  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd web-dashboard && npm ci
      - name: Run tests
        run: cd web-dashboard && npm test
      - name: Build
        run: cd web-dashboard && npm run build

  deploy-backend:
    needs: [test-backend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Render
        run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}

  deploy-web:
    needs: [test-web]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Monitoring & Observability

### Application Monitoring

**Backend Monitoring** (via Render or external service):
- Request rate and latency
- Error rate
- CPU and memory usage
- Database connection pool status

**Web Dashboard Monitoring** (via Vercel Analytics):
- Page load times
- Web Vitals (LCP, FID, CLS)
- Geographic distribution of users

**Database Monitoring** (via MongoDB Atlas):
- Query performance
- Index usage
- Slow query log
- Connection metrics

### Logging

**Backend Logging**:
```javascript
// Use Winston or Pino
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Measurement received', { measurementId, provider });
logger.error('Database error', { error: err.message, stack: err.stack });
```

**Log Aggregation**:
- **Option 1**: Render built-in logs
- **Option 2**: External service (Datadog, LogRocket, Sentry)

### Alerting

**Key Alerts**:
- API response time > 2s
- Error rate > 5%
- Database CPU > 80%
- Failed deployments
- SSL certificate expiration

**Alert Channels**:
- Email
- Slack webhook
- PagerDuty (for critical alerts)

---

## Backup & Disaster Recovery

### Database Backups
- **Frequency**: Continuous (MongoDB Atlas)
- **Retention**: 30 days
- **Testing**: Monthly restore test

### Configuration Backups
- Store in version control
- Environment variables in secure vault

### Recovery Time Objective (RTO)
- Target: < 1 hour for complete restore

### Recovery Point Objective (RPO)
- Target: < 5 minutes data loss

---

## Scaling Strategy

### Horizontal Scaling
- Backend: Auto-scale based on CPU (Render)
- Database: Replica sets (MongoDB Atlas)

### Vertical Scaling
- Database: Upgrade cluster tier as data grows
- Backend: Upgrade instance size if needed

### Geographic Scaling
- Multi-region deployment for global users
- CDN for static assets
- DNS-based routing

---

## Maintenance Windows

### Scheduled Maintenance
- **Frequency**: Monthly
- **Time**: Sunday 2-4 AM UTC
- **Tasks**: 
  - Database index optimization
  - Certificate rotation
  - Dependency updates

### Zero-Downtime Deployments
- Blue-green deployment strategy
- Health checks before traffic routing
- Rollback plan for failed deployments

---

## Security Considerations

### SSL/TLS
- Automatic HTTPS (Render, Vercel)
- Certificate auto-renewal
- Force HTTPS redirects

### Secrets Management
- Environment variables via platform
- Rotate keys every 90 days
- Never commit secrets to Git

### Network Security
- Database firewall (IP whitelist)
- Rate limiting on API
- DDoS protection (Cloudflare)

---

## Cost Estimation

### Monthly Costs (Approximate)

**Development**:
- MongoDB Atlas: $0 (M0 free tier)
- Render: $0 (free tier)
- Vercel: $0 (hobby plan)
- Total: **$0/month**

**Production (Small Scale)**:
- MongoDB Atlas: $57 (M10 cluster)
- Render: $7 (starter plan)
- Vercel: $0 (hobby) or $20 (pro)
- Expo: $0 (standard build)
- Total: **~$64-84/month**

**Production (Medium Scale)**:
- MongoDB Atlas: $200 (M30 cluster, backup)
- Render: $85 (standard plan + scaling)
- Vercel: $20 (pro plan)
- CDN: $20 (Cloudflare Pro)
- Monitoring: $30 (external service)
- Total: **~$355/month**

---

## Related Documentation
- [System Design](system-design.md)
- [Security](security.md)
- [Performance](performance.md)
