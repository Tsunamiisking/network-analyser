# Testing

## Overview

Comprehensive testing ensures the Network Analyser system is reliable, performant, and maintainable. This document outlines the testing strategy across all components.

## Testing Pyramid

```
           ┌─────────────┐
           │     E2E     │  Few, slow, expensive
           │   Tests     │
           └─────────────┘
         ┌─────────────────┐
         │  Integration    │  Some, moderate
         │     Tests       │
         └─────────────────┘
      ┌───────────────────────┐
      │      Unit Tests       │  Many, fast, cheap
      └───────────────────────┘
```

## Backend Testing

### Unit Tests

**Framework**: Jest

**What to Test**:
- Utility functions
- Data validation logic
- Business logic
- Service layer functions

**Example**:
```javascript
// backend/tests/utils/validators.test.js
const { validateSignalStrength, validateCoordinates } = require('../../utils/validators');

describe('validateSignalStrength', () => {
  it('should accept valid signal strength values', () => {
    expect(validateSignalStrength(-75)).toBe(true);
    expect(validateSignalStrength(-120)).toBe(true);
    expect(validateSignalStrength(-20)).toBe(true);
  });
  
  it('should reject out-of-range values', () => {
    expect(validateSignalStrength(-150)).toBe(false);
    expect(validateSignalStrength(0)).toBe(false);
    expect(validateSignalStrength(50)).toBe(false);
  });
  
  it('should reject non-numeric values', () => {
    expect(validateSignalStrength('invalid')).toBe(false);
    expect(validateSignalStrength(null)).toBe(false);
    expect(validateSignalStrength(undefined)).toBe(false);
  });
});

describe('validateCoordinates', () => {
  it('should accept valid coordinates', () => {
    expect(validateCoordinates(37.7749, -122.4194)).toBe(true);
  });
  
  it('should reject null island', () => {
    expect(validateCoordinates(0, 0)).toBe(false);
  });
  
  it('should reject out-of-range coordinates', () => {
    expect(validateCoordinates(91, 0)).toBe(false);
    expect(validateCoordinates(0, 181)).toBe(false);
  });
});
```

### Integration Tests

**What to Test**:
- API endpoints with database
- Service layer integration
- Authentication flows
- Data aggregation pipelines

**Example**:
```javascript
// backend/tests/integration/measurements.test.js
const request = require('supertest');
const app = require('../../app');
const { setupTestDb, teardownTestDb } = require('../helpers/db');

describe('Measurement API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  
  afterAll(async () => {
    await teardownTestDb();
  });
  
  describe('POST /api/v1/measurements', () => {
    it('should accept valid measurement', async () => {
      const measurement = {
        signalStrength: -75,
        latitude: 37.7749,
        longitude: -122.4194,
        provider: 'Verizon',
        connectionType: '5G',
        timestamp: new Date().toISOString(),
        deviceInfo: {
          platform: 'iOS',
          osVersion: '17.2'
        }
      };
      
      const response = await request(app)
        .post('/api/v1/measurements')
        .set('X-API-Key', process.env.TEST_API_KEY)
        .send(measurement)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.measurementId).toBeDefined();
    });
    
    it('should reject invalid signal strength', async () => {
      const measurement = {
        signalStrength: 100, // Invalid
        latitude: 37.7749,
        longitude: -122.4194,
        provider: 'Verizon',
        connectionType: '5G',
        timestamp: new Date().toISOString()
      };
      
      const response = await request(app)
        .post('/api/v1/measurements')
        .set('X-API-Key', process.env.TEST_API_KEY)
        .send(measurement)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('signal strength');
    });
    
    it('should enforce rate limiting', async () => {
      const measurement = {
        signalStrength: -75,
        latitude: 37.7749,
        longitude: -122.4194,
        provider: 'Verizon',
        connectionType: '5G',
        timestamp: new Date().toISOString()
      };
      
      // Make requests until rate limit hit
      for (let i = 0; i < 105; i++) {
        await request(app)
          .post('/api/v1/measurements')
          .set('X-API-Key', process.env.TEST_API_KEY)
          .send(measurement);
      }
      
      // This should be rate limited
      const response = await request(app)
        .post('/api/v1/measurements')
        .set('X-API-Key', process.env.TEST_API_KEY)
        .send(measurement)
        .expect(429);
      
      expect(response.body.error).toContain('rate limit');
    });
  });
  
  describe('GET /api/v1/measurements', () => {
    beforeEach(async () => {
      // Seed test data
      await db.collection('measurements').insertMany([
        {
          signalStrength: -70,
          location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
          provider: 'Verizon',
          timestamp: new Date()
        },
        {
          signalStrength: -80,
          location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
          provider: 'AT&T',
          timestamp: new Date()
        }
      ]);
    });
    
    it('should return measurements within radius', async () => {
      const response = await request(app)
        .get('/api/v1/measurements')
        .query({
          lat: 37.7749,
          lng: -122.4194,
          radius: 10
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.measurements).toHaveLength(2);
    });
    
    it('should filter by provider', async () => {
      const response = await request(app)
        .get('/api/v1/measurements')
        .query({
          lat: 37.7749,
          lng: -122.4194,
          radius: 10,
          provider: 'Verizon'
        })
        .expect(200);
      
      expect(response.body.measurements).toHaveLength(1);
      expect(response.body.measurements[0].provider).toBe('Verizon');
    });
  });
});
```

### Database Tests

**Testing Aggregation Pipelines**:
```javascript
// backend/tests/database/aggregations.test.js
describe('Aggregation Pipelines', () => {
  it('should calculate provider statistics correctly', async () => {
    // Seed data
    await db.collection('measurements').insertMany([
      { signalStrength: -70, provider: 'Verizon', location: { type: 'Point', coordinates: [-122.4, 37.7] } },
      { signalStrength: -80, provider: 'Verizon', location: { type: 'Point', coordinates: [-122.4, 37.7] } },
      { signalStrength: -75, provider: 'AT&T', location: { type: 'Point', coordinates: [-122.4, 37.7] } }
    ]);
    
    const stats = await calculateProviderStats({ lat: 37.7, lng: -122.4 }, 10);
    
    expect(stats).toHaveLength(2);
    expect(stats[0].provider).toBe('Verizon');
    expect(stats[0].avgSignal).toBe(-75); // (-70 + -80) / 2
    expect(stats[0].count).toBe(2);
  });
});
```

## Mobile App Testing

### Unit Tests

**Framework**: Jest + React Native Testing Library

**Example**:
```javascript
// mobile-app/src/services/__tests__/location.test.ts
import { LocationService } from '../location';

jest.mock('expo-location');

describe('LocationService', () => {
  it('should request location permissions', async () => {
    const service = new LocationService();
    await service.startTracking(jest.fn());
    
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });
  
  it('should throw error if permission denied', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    
    const service = new LocationService();
    
    await expect(service.startTracking(jest.fn())).rejects.toThrow('Location permission denied');
  });
});
```

### Component Tests

```javascript
// mobile-app/src/components/__tests__/SignalMeter.test.tsx
import { render, screen } from '@testing-library/react-native';
import { SignalMeter } from '../SignalMeter';

describe('SignalMeter', () => {
  it('should display signal strength', () => {
    render(<SignalMeter signalStrength={-75} />);
    
    expect(screen.getByText('-75 dBm')).toBeTruthy();
  });
  
  it('should show correct signal quality indicator', () => {
    const { rerender } = render(<SignalMeter signalStrength={-75} />);
    expect(screen.getByText('Good')).toBeTruthy();
    
    rerender(<SignalMeter signalStrength={-95} />);
    expect(screen.getByText('Poor')).toBeTruthy();
  });
});
```

### Integration Tests

```javascript
// mobile-app/src/__tests__/measurement-flow.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { HomeScreen } from '../screens/HomeScreen';
import { store } from '../store/store';

jest.mock('../services/api');
jest.mock('expo-location');

describe('Measurement Flow', () => {
  it('should collect and submit measurement', async () => {
    const { getByText } = render(
      <Provider store={store}>
        <HomeScreen />
      </Provider>
    );
    
    // Start tracking
    const startButton = getByText('Start Tracking');
    fireEvent.press(startButton);
    
    await waitFor(() => {
      expect(getByText('Stop Tracking')).toBeTruthy();
    });
    
    // Verify measurement was submitted
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/measurements', expect.any(Object));
    });
  });
});
```

## Web Dashboard Testing

### Unit Tests

**Framework**: Vitest + Testing Library

**Example**:
```javascript
// web-dashboard/src/utils/__tests__/formatters.test.ts
import { formatSignalStrength, formatDistance } from '../formatters';

describe('formatSignalStrength', () => {
  it('should format signal strength with quality indicator', () => {
    expect(formatSignalStrength(-65)).toBe('-65 dBm (Excellent)');
    expect(formatSignalStrength(-75)).toBe('-75 dBm (Good)');
    expect(formatSignalStrength(-85)).toBe('-85 dBm (Fair)');
    expect(formatSignalStrength(-95)).toBe('-95 dBm (Poor)');
  });
});

describe('formatDistance', () => {
  it('should format distance in km', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(500)).toBe('0.5 km');
  });
  
  it('should format distance in meters for short distances', () => {
    expect(formatDistance(50)).toBe('50 m');
  });
});
```

### Component Tests

```javascript
// web-dashboard/src/components/__tests__/ProviderComparisonChart.test.tsx
import { render, screen } from '@testing-library/react';
import { ProviderComparisonChart } from '../ProviderComparisonChart';

const mockData = [
  { provider: 'Verizon', avgSignal: -70, count: 100 },
  { provider: 'AT&T', avgSignal: -75, count: 90 }
];

describe('ProviderComparisonChart', () => {
  it('should render provider names', () => {
    render(<ProviderComparisonChart data={mockData} />);
    
    expect(screen.getByText('Verizon')).toBeInTheDocument();
    expect(screen.getByText('AT&T')).toBeInTheDocument();
  });
  
  it('should display loading state', () => {
    render(<ProviderComparisonChart data={null} isLoading={true} />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

### Integration Tests

```javascript
// web-dashboard/src/pages/__tests__/Dashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../Dashboard';

const queryClient = new QueryClient();

describe('Dashboard Page', () => {
  it('should fetch and display statistics', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Total Measurements/i)).toBeInTheDocument();
    });
  });
});
```

## E2E Testing

### Backend E2E

**Framework**: REST Client or Postman

**Collection** (Postman):
```json
{
  "info": { "name": "Network Analyser API" },
  "item": [
    {
      "name": "Submit Measurement",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/v1/measurements",
        "header": [
          { "key": "X-API-Key", "value": "{{apiKey}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"signalStrength\": -75,\n  \"latitude\": 37.7749,\n  \"longitude\": -122.4194,\n  \"provider\": \"Verizon\",\n  \"connectionType\": \"5G\",\n  \"timestamp\": \"{{$isoTimestamp}}\"\n}"
        }
      },
      "tests": [
        "pm.test('Status is 201', () => pm.response.to.have.status(201));",
        "pm.test('Response has measurementId', () => pm.expect(pm.response.json()).to.have.property('measurementId'));"
      ]
    }
  ]
}
```

### Web Dashboard E2E

**Framework**: Playwright

**Example**:
```javascript
// web-dashboard/tests/e2e/heatmap.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Heatmap View', () => {
  test('should load and display heatmap', async ({ page }) => {
    await page.goto('/heatmap');
    
    // Wait for map to load
    await page.waitForSelector('.mapboxgl-canvas');
    
    // Check for provider filter
    const providerFilter = page.locator('[data-testid="provider-filter"]');
    await expect(providerFilter).toBeVisible();
    
    // Select provider
    await providerFilter.click();
    await page.click('text=Verizon');
    
    // Verify map updates
    await page.waitForTimeout(1000); // Wait for data refresh
    
    // Take screenshot for visual regression
    await page.screenshot({ path: 'heatmap-verizon.png' });
  });
  
  test('should handle date range selection', async ({ page }) => {
    await page.goto('/heatmap');
    
    // Open date picker
    await page.click('[data-testid="date-range-picker"]');
    
    // Select last 7 days
    await page.click('text=Last 7 days');
    
    // Verify URL updated
    expect(page.url()).toContain('dateRange=7d');
  });
});
```

### Mobile App E2E

**Framework**: Detox

**Example**:
```javascript
// mobile-app/e2e/measurement.test.js
describe('Measurement Collection', () => {
  beforeAll(async () => {
    await device.launchApp();
  });
  
  it('should start and stop tracking', async () => {
    // Grant location permission
    await device.launchApp({ permissions: { location: 'always' } });
    
    // Navigate to home screen
    await element(by.id('home-tab')).tap();
    
    // Start tracking
    await element(by.id('start-tracking-button')).tap();
    
    // Verify tracking started
    await expect(element(by.id('stop-tracking-button'))).toBeVisible();
    await expect(element(by.text('Tracking...'))).toBeVisible();
    
    // Wait for measurement
    await waitFor(element(by.id('signal-strength')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Stop tracking
    await element(by.id('stop-tracking-button')).tap();
    
    // Verify tracking stopped
    await expect(element(by.id('start-tracking-button'))).toBeVisible();
  });
});
```

## Performance Testing

### Load Testing

**Framework**: Artillery

**Configuration**:
```yaml
# artillery-config.yml
config:
  target: "https://api.network-analyser.com"
  phases:
    - duration: 60
      arrivalRate: 10    # 10 users per second
      name: "Warm up"
    - duration: 120
      arrivalRate: 50    # 50 users per second
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100   # 100 users per second
      name: "Peak load"

scenarios:
  - name: "Submit measurement"
    flow:
      - post:
          url: "/api/v1/measurements"
          headers:
            X-API-Key: "{{ $processEnvironment.API_KEY }}"
          json:
            signalStrength: -75
            latitude: 37.7749
            longitude: -122.4194
            provider: "Verizon"
            connectionType: "5G"
            timestamp: "{{ $timestamp }}"
```

**Run**:
```bash
artillery run artillery-config.yml
```

### Stress Testing

```yaml
# stress-test.yml
config:
  target: "https://api.network-analyser.com"
  phases:
    - duration: 300
      arrivalRate: 200   # Push beyond normal capacity
      name: "Stress test"

scenarios:
  - name: "Heavy aggregation query"
    flow:
      - get:
          url: "/api/v1/analytics/heatmap?bounds=-122.5,37.7,-122.3,37.8"
```

## Test Coverage

### Coverage Goals

- **Unit tests**: > 80% code coverage
- **Integration tests**: Critical paths covered
- **E2E tests**: Major user flows covered

### Measuring Coverage

```bash
# Backend
cd backend
npm run test:coverage

# Web Dashboard
cd web-dashboard
npm run test:coverage

# Mobile App
cd mobile-app
npm run test:coverage
```

### Coverage Report Example

```
File                 | % Stmts | % Branch | % Funcs | % Lines |
---------------------|---------|----------|---------|---------|
All files            |   82.45 |    75.32 |   88.12 |   82.67 |
 services/           |   91.23 |    85.44 |   94.32 |   91.45 |
  api.js             |   95.12 |    88.23 |   97.45 |   95.34 |
  location.js        |   87.34 |    82.65 |   91.19 |   87.56 |
 utils/              |   78.45 |    68.23 |   82.11 |   78.89 |
  validators.js      |   88.21 |    75.34 |   89.45 |   88.67 |
```

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
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
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/coverage-final.json

  web-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: cd web-dashboard && npm ci
      - name: Run tests
        run: cd web-dashboard && npm test

  mobile-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: cd mobile-app && npm ci
      - name: Run tests
        run: cd mobile-app && npm test
```

## Test Data Management

### Fixtures

```javascript
// tests/fixtures/measurements.js
module.exports = {
  validMeasurement: {
    signalStrength: -75,
    latitude: 37.7749,
    longitude: -122.4194,
    provider: 'Verizon',
    connectionType: '5G',
    timestamp: '2026-03-03T12:00:00Z',
    deviceInfo: {
      platform: 'iOS',
      osVersion: '17.2'
    }
  },
  
  measurements: [
    // ... array of sample measurements
  ]
};
```

### Database Seeding

```javascript
// tests/helpers/seed.js
async function seedDatabase() {
  await db.collection('measurements').deleteMany({});
  await db.collection('measurements').insertMany(fixtures.measurements);
}
```

## Related Documentation
- [System Design](system-design.md)
- [Performance](performance.md)
- [Deployment](deployment.md)
