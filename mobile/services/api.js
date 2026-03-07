import { API_BASE_URL, ENDPOINTS } from '../config/api';

// Generic fetch wrapper
const apiFetch = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
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
  const queryParams = new URLSearchParams(filters).toString();
  const endpoint = queryParams ? `${ENDPOINTS.HEATMAP}?${queryParams}` : ENDPOINTS.HEATMAP;
  return apiFetch(endpoint);
};

// Get aggregated heatmap data
export const getAggregatedHeatmap = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const endpoint = queryParams ? `${ENDPOINTS.HEATMAP_AGGREGATED}?${queryParams}` : ENDPOINTS.HEATMAP_AGGREGATED;
  return apiFetch(endpoint);
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
