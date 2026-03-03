# Web Architecture

## Overview

The web dashboard is built using **React.js**, providing an interactive interface for visualizing network performance data, comparing providers, and administrative control.

## Architecture Pattern

The web application follows a **component-based architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│     (React Components & Pages)          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         State Management Layer          │
│  (Context API / Redux / React Query)    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Service Layer                   │
│    (API Client, Data Transformers)      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         External Services               │
│   (Backend API, Map Services)           │
└─────────────────────────────────────────┘
```

## Project Structure

```
web-dashboard/
├── src/
│   ├── components/        # Reusable components
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── map/
│   │   │   ├── HeatmapLayer.tsx
│   │   │   ├── MarkerCluster.tsx
│   │   │   └── MapControls.tsx
│   │   ├── charts/
│   │   │   ├── TimeSeriesChart.tsx
│   │   │   ├── ProviderComparisonChart.tsx
│   │   │   └── SignalDistributionChart.tsx
│   │   └── filters/
│   │       ├── DateRangePicker.tsx
│   │       ├── ProviderFilter.tsx
│   │       └── LocationSearch.tsx
│   ├── pages/             # Route-level pages
│   │   ├── Dashboard.tsx
│   │   ├── HeatmapView.tsx
│   │   ├── Analytics.tsx
│   │   ├── ProviderComparison.tsx
│   │   ├── OutageTracker.tsx
│   │   └── Admin.tsx
│   ├── services/          # API and external services
│   │   ├── api/
│   │   │   ├── measurements.ts
│   │   │   ├── analytics.ts
│   │   │   ├── outages.ts
│   │   │   └── admin.ts
│   │   ├── mapService.ts
│   │   └── storageService.ts
│   ├── hooks/             # Custom React hooks
│   │   ├── useHeatmapData.ts
│   │   ├── useProviderStats.ts
│   │   ├── useTrends.ts
│   │   └── useDebounce.ts
│   ├── contexts/          # React contexts
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── utils/             # Helper functions
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── colorScales.ts
│   │   └── constants.ts
│   ├── types/             # TypeScript definitions
│   │   └── index.d.ts
│   ├── styles/            # Global styles
│   │   └── globals.css
│   ├── App.tsx            # Root component
│   └── main.tsx           # Entry point
├── public/                # Static assets
├── package.json
├── vite.config.ts         # Build configuration
└── tsconfig.json
```

## Core Features

### 1. Interactive Heatmap

**Purpose**: Visualize signal strength across geographic regions

**Technology**: Mapbox GL JS or Google Maps API

**Key Features**:
- Color-coded signal strength overlay
- Dynamic data loading based on viewport
- Zoom-level adaptive clustering
- Provider filtering
- Time range selection

**Implementation:**
```typescript
// components/map/HeatmapLayer.tsx
import { useEffect, useState } from 'react';
import { Map, Layer, Source } from 'react-map-gl';
import { useHeatmapData } from '../../hooks/useHeatmapData';

export const HeatmapLayer = ({ provider, dateRange }) => {
  const [viewport, setViewport] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
    zoom: 10
  });
  
  const { data, isLoading } = useHeatmapData({
    bounds: viewport.bounds,
    provider,
    dateRange
  });
  
  const heatmapLayer = {
    type: 'heatmap',
    paint: {
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['get', 'avgSignalStrength'],
        -100, 0,    // Poor signal → low weight
        -50, 1      // Good signal → high weight
      ],
      'heatmap-intensity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 1,
        9, 3
      ],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(178,24,43)'
      ]
    }
  };
  
  return (
    <Map
      {...viewport}
      onMove={evt => setViewport(evt.viewState)}
      mapStyle="mapbox://styles/mapbox/dark-v10"
    >
      <Source type="geojson" data={data}>
        <Layer {...heatmapLayer} />
      </Source>
    </Map>
  );
};
```

### 2. Analytics Dashboard

**Purpose**: Display aggregated statistics and trends

**Technology**: Recharts or Chart.js

**Key Visualizations**:
- Time-series line charts (signal trends)
- Bar charts (provider comparison)
- Pie charts (connection type distribution)
- Stats cards (KPIs)

**Implementation:**
```typescript
// pages/Analytics.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useTrends } from '../hooks/useTrends';

export const Analytics = () => {
  const { data: trendsData } = useTrends({
    provider: 'Verizon',
    startDate: '2026-02-01',
    endDate: '2026-03-03',
    interval: 'day'
  });
  
  return (
    <div className="analytics-container">
      <h2>Signal Strength Trends</h2>
      <LineChart width={800} height={400} data={trendsData}>
        <XAxis dataKey="timestamp" />
        <YAxis domain={[-100, -40]} />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="avgSignalStrength" 
          stroke="#8884d8" 
          strokeWidth={2}
        />
      </LineChart>
    </div>
  );
};
```

### 3. Provider Comparison

**Purpose**: Compare network performance across providers

**Key Features**:
- Side-by-side statistics
- Coverage area comparison
- Signal quality percentile breakdown
- Regional performance maps

**Implementation:**
```typescript
// hooks/useProviderStats.ts
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api/analytics';

export const useProviderStats = ({ location, radius, dateRange }) => {
  return useQuery({
    queryKey: ['providerStats', location, radius, dateRange],
    queryFn: () => analyticsApi.getProviderComparison({
      lat: location.lat,
      lng: location.lng,
      radius,
      startDate: dateRange.start,
      endDate: dateRange.end
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
};
```

### 4. Outage Tracker

**Purpose**: Display active and resolved network outages

**Key Features**:
- Real-time outage map
- Outage severity indicators
- Report submission form
- Outage history timeline

### 5. Admin Panel

**Purpose**: System monitoring and data management

**Key Features**:
- System statistics dashboard
- Data quality metrics
- User management (future)
- API usage monitoring

## Data Fetching Strategy

### React Query Integration

**Benefits**:
- Automatic caching and invalidation
- Background refetching
- Optimistic updates
- Pagination support

**Configuration:**
```typescript
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      cacheTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false
    }
  }
});

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <Router>
      {/* App routes */}
    </Router>
  </QueryClientProvider>
);
```

## State Management

### Local Component State
- Form inputs
- UI toggles (modals, dropdowns)
- Temporary view state

### Context API
- Authentication state
- Theme preferences
- Global configuration

### React Query
- Server state (API data)
- Background sync
- Cache management

## Performance Optimizations

### Code Splitting
```typescript
// Lazy load route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const HeatmapView = lazy(() => import('./pages/HeatmapView'));
```

### Memoization
```typescript
// Prevent unnecessary re-renders
const MemoizedChart = memo(({ data }) => {
  return <ComplexChart data={data} />;
}, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data;
});
```

### Virtual Scrolling
- Render only visible list items
- Used for large datasets (measurement history)

### Image Optimization
- WebP format with fallbacks
- Lazy loading for below-fold images
- Responsive images with srcset

### API Request Optimization
- Debounced search inputs
- Request cancellation for outdated queries
- Batch similar requests

## Map Performance

### Clustering
- Group nearby markers at lower zoom levels
- Reduce map layer complexity
- Dynamic cluster sizing

### Viewport-Based Loading
- Only fetch data for visible area
- Update on pan/zoom with debounce
- Progressive tile loading

### Canvas Rendering
- Use canvas layers for large datasets
- Hardware-accelerated rendering
- Optimize redraw frequency

## Responsive Design

### Breakpoints
```css
/* Mobile first approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

### Mobile Considerations
- Touch-friendly UI elements
- Simplified map controls
- Collapsible side panels
- Bottom sheet modals

## Error Handling

### Error Boundaries
```typescript
// components/common/ErrorBoundary.tsx
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Log to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### API Error Handling
- Network errors → Retry with exponential backoff
- 404 errors → Show "not found" message
- 500 errors → Show generic error message
- Validation errors → Show field-specific errors

## Security Considerations

### XSS Prevention
- Sanitize user inputs
- Use React's built-in escaping
- Content Security Policy headers

### Authentication
- JWT token storage in memory or httpOnly cookies
- Refresh token rotation
- Session timeout handling

### CORS
- Whitelist allowed origins
- Credentials handling
- Preflight request optimization

## Testing

### Unit Tests (Vitest)
- Component rendering
- Hook logic
- Utility functions

### Integration Tests (Testing Library)
- User interactions
- Form submissions
- API integration with MSW

### E2E Tests (Playwright)
- Critical user flows
- Cross-browser compatibility
- Mobile responsiveness

## Build and Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Deployment (Vercel)
- Automatic deploys from main branch
- Preview deployments for PRs
- Environment variable management
- Edge caching configuration

## Related Documentation
- [System Design](system-design.md)
- [API Specification](api-specification.md)
- [Performance](performance.md)
- [Testing](testing.md)
