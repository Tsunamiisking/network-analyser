# Security

## Overview

Security is paramount for the Network Analyser system as it handles user location data and network information. This document outlines security measures, best practices, and threat mitigations.

## Security Principles

1. **Privacy by Design**: Minimize data collection and retention
2. **Defense in Depth**: Multiple layers of security controls
3. **Least Privilege**: Minimal access rights for users and services
4. **Secure by Default**: Safe configurations out of the box
5. **Transparency**: Clear privacy policies and data usage

## Data Privacy

### Personal Data Handling

**What We Collect**:
- GPS coordinates (precise location)
- Network signal strength
- Network provider name
- Device type and OS version
- IP address (temporarily for abuse detection)

**What We Don't Collect**:
- User names or email addresses (in basic version)
- Phone numbers
- Device identifiers (IMEI, IMSI)
- Contacts or messages
- Payment information

### Data Anonymization

**Location Fuzzing** (optional for enhanced privacy):
```javascript
function fuzzLocation(lat, lng, radiusMeters = 100) {
  // Add random offset within specified radius
  const randomAngle = Math.random() * 2 * Math.PI;
  const randomDistance = Math.random() * radiusMeters;
  
  const latOffset = (randomDistance * Math.cos(randomAngle)) / 111111;
  const lngOffset = (randomDistance * Math.sin(randomAngle)) / (111111 * Math.cos(lat * Math.PI / 180));
  
  return {
    latitude: lat + latOffset,
    longitude: lng + lngOffset
  };
}
```

**IP Address Hashing**:
```javascript
const crypto = require('crypto');

function hashIpAddress(ip) {
  return crypto
    .createHash('sha256')
    .update(ip + process.env.IP_SALT)
    .digest('hex')
    .substring(0, 16);
}
```

### Data Retention Policy

| Data Type | Retention Period | Reasoning |
|-----------|-----------------|-----------|
| Raw measurements | 90 days | Support analytics and trend detection |
| Aggregated data | 2 years | Long-term performance tracking |
| IP addresses | 7 days | Abuse detection only |
| Error logs | 30 days | Debugging and monitoring |
| Audit logs | 1 year | Security compliance |

**Automated Cleanup**:
```javascript
// MongoDB TTL index for automatic deletion
db.measurements.createIndex(
  { "timestamp": 1 },
  { expireAfterSeconds: 7776000 } // 90 days
);

db.logs.createIndex(
  { "createdAt": 1 },
  { expireAfterSeconds: 2592000 } // 30 days
);
```

### GDPR Compliance

**Right to Access**:
```javascript
// Endpoint to retrieve user's data
app.get('/api/v1/user/data', authenticate, async (req, res) => {
  const userId = req.user.id;
  
  const measurements = await db.collection('measurements')
    .find({ userId })
    .toArray();
  
  res.json({
    measurements,
    exportedAt: new Date().toISOString()
  });
});
```

**Right to Erasure**:
```javascript
// Endpoint to delete user's data
app.delete('/api/v1/user/data', authenticate, async (req, res) => {
  const userId = req.user.id;
  
  await db.collection('measurements').deleteMany({ userId });
  await db.collection('users').deleteOne({ _id: userId });
  
  res.json({ success: true, message: 'Data deleted' });
});
```

## API Security

### Authentication

**API Key Authentication** (for mobile apps):
```javascript
const apiKeyMiddleware = async (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Validate API key
  const user = await db.collection('users').findOne({ apiKey });
  
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.user = user;
  next();
};
```

**JWT Authentication** (for web dashboard):
```javascript
const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const jwtMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Token Refresh**:
```javascript
app.post('/api/v1/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await db.collection('users').findOne({ _id: decoded.id });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const newToken = generateToken(user);
    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### Rate Limiting

**Express Rate Limit**:
```javascript
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for measurement submission
const measurementLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 measurements per minute
  skipSuccessfulRequests: false,
});

app.use('/api/v1/', apiLimiter);
app.post('/api/v1/measurements', measurementLimiter, submitMeasurement);
```

**IP-Based Rate Limiting**:
```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(ip, limit, window) {
  const key = `rate_limit:${ip}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, window);
  }
  
  return current <= limit;
}

const rateLimitMiddleware = (limit, window) => async (req, res, next) => {
  const ip = req.ip;
  const allowed = await checkRateLimit(ip, limit, window);
  
  if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  next();
};
```

### Input Validation

**Schema Validation** (using Joi):
```javascript
const Joi = require('joi');

const measurementSchema = Joi.object({
  signalStrength: Joi.number().min(-120).max(-20).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  provider: Joi.string().max(50).required(),
  connectionType: Joi.string().valid('2G', '3G', '4G', '5G', 'LTE').required(),
  timestamp: Joi.date().iso().max('now').required(),
  deviceInfo: Joi.object({
    platform: Joi.string().valid('iOS', 'Android').required(),
    osVersion: Joi.string().max(20).required()
  }).required()
});

const validateMeasurement = (req, res, next) => {
  const { error } = measurementSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.details 
    });
  }
  
  next();
};
```

**SQL Injection Prevention** (even though using MongoDB):
```javascript
// Always use parameterized queries
// MongoDB automatically prevents injection with proper usage

// BAD (vulnerable to injection)
db.collection('users').find({ email: req.body.email });

// GOOD (safe)
db.collection('users').find({ email: String(req.body.email) });

// BETTER (with validation)
const email = measurementSchema.validate(req.body.email);
db.collection('users').find({ email });
```

### CORS Configuration

```javascript
const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://network-analyser.com',
      'https://www.network-analyser.com',
      'https://dashboard.network-analyser.com'
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

## Database Security

### MongoDB Security

**Authentication**:
```javascript
// Connection with authentication
const uri = `mongodb+srv://${username}:${password}@cluster0.mongodb.net/${dbName}?retryWrites=true&w=majority`;
```

**Network Access Control**:
- Whitelist specific IP addresses
- Use VPC peering for enhanced security
- Enable private endpoint (Atlas)

**Encryption**:
- Encryption at rest (enabled by default on Atlas)
- Encryption in transit (TLS/SSL)

**Audit Logging**:
```javascript
// Enable audit logging (Atlas M10+)
// Tracks:
// - Authentication attempts
// - Authorization failures
// - Schema changes
// - Data access patterns
```

**Role-Based Access Control**:
```javascript
// Create limited-privilege user
db.createUser({
  user: "app_user",
  pwd: "strong_password",
  roles: [
    { role: "readWrite", db: "network-analyser" }
  ]
});

// Analytics read-only user
db.createUser({
  user: "analytics_user",
  pwd: "strong_password",
  roles: [
    { role: "read", db: "network-analyser" }
  ]
});
```

## Transport Security

### HTTPS Enforcement

```javascript
// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

### Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.network-analyser.com"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true
}));
```

## Mobile App Security

### Secure Storage

**React Native Secure Storage**:
```javascript
import * as SecureStore from 'expo-secure-store';

// Store API key securely
async function saveApiKey(key) {
  await SecureStore.setItemAsync('api_key', key);
}

// Retrieve API key
async function getApiKey() {
  return await SecureStore.getItemAsync('api_key');
}
```

### Certificate Pinning (Advanced)

```javascript
// Prevent man-in-the-middle attacks
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  ca: fs.readFileSync('./certificates/ca-cert.pem'),
  checkServerIdentity: (host, cert) => {
    const expectedFingerprint = 'AA:BB:CC:...';
    const actualFingerprint = cert.fingerprint;
    
    if (expectedFingerprint !== actualFingerprint) {
      throw new Error('Certificate pinning failed');
    }
  }
});

const apiClient = axios.create({
  httpsAgent: agent
});
```

### Code Obfuscation

```javascript
// For sensitive logic in mobile app
// Use tools like:
// - metro-react-native-babel-preset
// - javascript-obfuscator
```

## Abuse Prevention

### Suspicious Activity Detection

```javascript
async function detectAnomalies(measurement, userId) {
  const recentMeasurements = await db.collection('measurements')
    .find({ userId })
    .sort({ timestamp: -1 })
    .limit(10)
    .toArray();
  
  // Check for impossible travel
  if (recentMeasurements.length > 0) {
    const lastMeasurement = recentMeasurements[0];
    const distance = calculateDistance(
      measurement.latitude,
      measurement.longitude,
      lastMeasurement.latitude,
      lastMeasurement.longitude
    );
    
    const timeDiff = (new Date(measurement.timestamp) - new Date(lastMeasurement.timestamp)) / 1000 / 60; // minutes
    const speed = distance / timeDiff * 60; // km/h
    
    // Flag if speed > 500 km/h (impossible for ground travel)
    if (speed > 500) {
      await flagSuspiciousActivity(userId, 'impossible_travel', { speed, distance, timeDiff });
    }
  }
  
  // Check for bot-like behavior (too many submissions)
  const last5Minutes = await db.collection('measurements')
    .countDocuments({
      userId,
      timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
  
  if (last5Minutes > 50) {
    await flagSuspiciousActivity(userId, 'excessive_submission', { count: last5Minutes });
  }
}
```

### Captcha Integration (for web)

```javascript
// Using reCAPTCHA for sensitive operations
const fetch = require('node-fetch');

async function verifyCaptcha(token) {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${process.env.RECAPTCHA_SECRET}&response=${token}`
  });
  
  const data = await response.json();
  return data.success && data.score > 0.5;
}
```

## Secrets Management

### Environment Variables

```bash
# Never commit to version control
# Use platform-specific secret management

# Render
render secrets set API_KEY_SECRET=xxxxx

# Vercel
vercel env add API_KEY_SECRET

# Local development
# Use .env file (add to .gitignore)
```

### Key Rotation

```javascript
// Implement key versioning
const API_KEY_VERSIONS = {
  v1: process.env.API_KEY_V1,
  v2: process.env.API_KEY_V2 // New key
};

function validateApiKey(key) {
  return Object.values(API_KEY_VERSIONS).includes(key);
}

// Gradual migration:
// 1. Deploy v2 key
// 2. Update clients to use v2
// 3. After migration complete, remove v1
```

## Logging & Monitoring

### Security Event Logging

```javascript
function logSecurityEvent(event, details) {
  logger.warn('Security event', {
    event,
    details,
    timestamp: new Date(),
    ip: details.ip,
    userId: details.userId
  });
  
  // Send to SIEM or alert system if critical
  if (['authentication_failure', 'suspicious_activity'].includes(event)) {
    sendAlertToSlack(event, details);
  }
}
```

### Audit Trail

```javascript
async function createAuditLog(action, userId, resource, changes) {
  await db.collection('audit_logs').insertOne({
    action, // 'create', 'update', 'delete', 'access'
    userId,
    resource, // 'measurement', 'user', 'settings'
    changes,
    timestamp: new Date(),
    ip: req.ip
  });
}
```

## Incident Response

### Security Breach Procedure

1. **Detection**: Automated alerts + manual monitoring
2. **Containment**: Disable compromised accounts, rotate keys
3. **Investigation**: Analyze logs, determine scope
4. **Remediation**: Patch vulnerabilities, restore systems
5. **Notification**: Inform affected users (if required)
6. **Post-Mortem**: Document and improve

### Contact Information

```
Security Email: security@network-analyser.com
Response Time: < 24 hours for critical issues
```

## Compliance

### Data Protection Standards
- GDPR (EU)
- CCPA (California)
- Privacy by design principles

### Regular Security Audits
- Quarterly dependency updates
- Annual penetration testing
- Continuous vulnerability scanning

## Related Documentation
- [Deployment](deployment.md)
- [API Specification](api-specification.md)
- [Database Schema](database-schema.md)
