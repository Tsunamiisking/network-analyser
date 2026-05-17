import { API_BASE_URL } from '../config/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ── Network data ───────────────────────────────────────────────
export function getHeatmapData(filters = {}) {
  return apiFetch(`/networks/heatmap${buildQuery(filters)}`);
}

export function getAggregatedHeatmap(filters = {}) {
  return apiFetch(`/networks/heatmap/aggregated${buildQuery(filters)}`);
}

export function getBestNetwork(lat, lng, radius) {
  return apiFetch(`/networks/best${buildQuery({ lat, lng, radius })}`);
}

export function getDeadZones(filters = {}) {
  return apiFetch(`/networks/deadzones${buildQuery(filters)}`);
}

export function getHistory(deviceId) {
  return apiFetch(`/networks/history${buildQuery({ deviceId })}`);
}

// ── Reports ───────────────────────────────────────────────────
export function getReports(filters = {}) {
  return apiFetch(`/reports${buildQuery(filters)}`);
}

// ── Analytics ─────────────────────────────────────────────────
export function getProviderComparison() {
  return apiFetch('/analytics/provider-comparison');
}

export function getBlackoutRate(startDate, endDate) {
  return apiFetch(`/analytics/blackout-rate${buildQuery({ startDate, endDate })}`);
}

// ── Clustering ────────────────────────────────────────────────
export function getClusterDeadZones() {
  return apiFetch('/clustering/deadzones');
}

export function getSignalQualityClusters() {
  return apiFetch('/clustering/signal-quality');
}
