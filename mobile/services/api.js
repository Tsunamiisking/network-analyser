import { API_BASE_URL, ENDPOINTS } from '../config/api';

/**
 * Check API connectivity
 * @returns {Promise<{connected: boolean, latency: number, error: string}>}
 */
export const checkAPIHealth = async () => {
  const startTime = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}/networks/heatmap?limit=1`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5s timeout for health check
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      return { connected: true, latency, error: null };
    } else {
      return { 
        connected: false, 
        latency, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    return { 
      connected: false, 
      latency,
      error: error.message || 'Network error'
    };
  }
};

// Generic fetch wrapper with timeout and retry
const apiFetch = async (endpoint, options = {}) => {
  const { timeout = 15000, retries = 2, ...fetchOptions } = options;
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`📡 API Request (attempt ${attempt + 1}): ${API_BASE_URL}${endpoint}`);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        signal: controller.signal,
        ...fetchOptions,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `API request failed with status ${response.status}`);
      }

      console.log(`✅ API Success: ${endpoint}`);
      return data;
      
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      
      // Don't retry on abort (timeout) or successful fetch with bad response
      if (error.name === 'AbortError') {
        console.error(`⏱️  API Timeout (${timeout}ms): ${endpoint}`);
        throw new Error(`Request timed out after ${timeout}ms. The server might be slow or unreachable.`);
      }
      
      // Network errors - retry
      if (attempt < retries && (error.message.includes('Network') || error.message.includes('fetch'))) {
        console.warn(`⚠️  Network error, retrying (${attempt + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }
      
      console.error('❌ API Error:', error);
      break;
    }
  }
  
  throw lastError;
};

/**
 * Clean filters by removing undefined/null values
 * @param {Object} filters - Filter object
 * @returns {Object} Cleaned filter object
 */
const cleanFilters = (filters) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

// Submit network data
export const submitNetworkData = async (networkData) => {
  return apiFetch(ENDPOINTS.NETWORKS, {
    method: 'POST',
    body: JSON.stringify(networkData),
  });
};

// Get heatmap data
export const getHeatmapData = async (filters = {}) => {
  const queryParams = new URLSearchParams(cleanFilters(filters)).toString();
  const endpoint = queryParams ? `${ENDPOINTS.HEATMAP}?${queryParams}` : ENDPOINTS.HEATMAP;
  return apiFetch(endpoint);
};

// Get aggregated heatmap data
export const getAggregatedHeatmap = async (filters = {}) => {
  const queryParams = new URLSearchParams(cleanFilters(filters)).toString();
  const endpoint = queryParams ? `${ENDPOINTS.HEATMAP_AGGREGATED}?${queryParams}` : ENDPOINTS.HEATMAP_AGGREGATED;
  return apiFetch(endpoint, { timeout: 45000 }); // 45s timeout for aggregation
};

// Get best network at location
export const getBestNetwork = async (lat, lng, radius = 2000) => {
  return apiFetch(`${ENDPOINTS.BEST_NETWORK}?lat=${lat}&lng=${lng}&radius=${radius}`);
};

// Get device history
export const getMyHistory = async (deviceId, limit = 50) => {
  return apiFetch(`${ENDPOINTS.MY_HISTORY}?deviceId=${deviceId}&limit=${limit}`);
};

// Submit report
export const submitReport = async (reportData) => {
  return apiFetch(ENDPOINTS.REPORTS, {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
};

// Get reports
export const getReports = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const endpoint = queryParams ? `${ENDPOINTS.REPORTS}?${queryParams}` : ENDPOINTS.REPORTS;
  return apiFetch(endpoint);
};

// Get provider comparison
export const getProviderComparison = async () => {
  return apiFetch(ENDPOINTS.PROVIDER_COMPARISON);
};

// Get blackout rate
export const getBlackoutRate = async (startDate, endDate) => {
  const params = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
  return apiFetch(`${ENDPOINTS.BLACKOUT_RATE}${params}`);
};

// ============================================
// DBSCAN Clustering APIs
// ============================================

/**
 * Get dead zone clusters using DBSCAN
 * @param {Object} filters - { provider, startDate, endDate, minLat, maxLat, minLng, maxLng, epsilon, minPoints }
 */
export const getDeadZoneClusters = async (filters = {}) => {
  const queryParams = new URLSearchParams(cleanFilters(filters)).toString();
  const endpoint = queryParams ? `${ENDPOINTS.CLUSTERING_DEADZONES}?${queryParams}` : ENDPOINTS.CLUSTERING_DEADZONES;
  return apiFetch(endpoint, { timeout: 30000 }); // 30s timeout for DBSCAN
};

/**
 * Get signal quality clusters using DBSCAN
 * @param {Object} filters - { qualityLevel, provider, startDate, endDate, minLat, maxLat, minLng, maxLng, epsilon, minPoints }
 */
export const getSignalQualityClusters = async (filters = {}) => {
  const queryParams = new URLSearchParams(cleanFilters(filters)).toString();
  const endpoint = queryParams ? `${ENDPOINTS.CLUSTERING_SIGNAL_QUALITY}?${queryParams}` : ENDPOINTS.CLUSTERING_SIGNAL_QUALITY;
  return apiFetch(endpoint, { timeout: 30000 }); // 30s timeout for DBSCAN
};

/**
 * Get provider-specific coverage clusters
 * @param {String} provider - MTN, Airtel, Glo, or 9mobile
 * @param {Object} filters - { startDate, endDate, minLat, maxLat, minLng, maxLng, epsilon, minPoints }
 */
export const getProviderClusters = async (provider, filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const endpoint = queryParams 
    ? `${ENDPOINTS.CLUSTERING_PROVIDER}/${provider}?${queryParams}` 
    : `${ENDPOINTS.CLUSTERING_PROVIDER}/${provider}`;
  return apiFetch(endpoint, { timeout: 30000 }); // 30s timeout for DBSCAN
};

/**
 * Get anomalies/outliers using DBSCAN
 * @param {Object} filters - { provider, startDate, endDate, minLat, maxLat, minLng, maxLng, epsilon, minPoints }
 */
export const getAnomalies = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const endpoint = queryParams ? `${ENDPOINTS.CLUSTERING_ANOMALIES}?${queryParams}` : ENDPOINTS.CLUSTERING_ANOMALIES;
  return apiFetch(endpoint, { timeout: 30000 }); // 30s timeout for DBSCAN
};
