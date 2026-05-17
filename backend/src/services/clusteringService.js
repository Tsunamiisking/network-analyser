const DBSCAN = require('density-clustering').DBSCAN;

/**
 * Haversine distance calculation between two lat/lng points
 * Returns distance in meters
 */
function haversineDistance(point1, point2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = point1[0] * Math.PI / 180;
  const φ2 = point2[0] * Math.PI / 180;
  const Δφ = (point2[0] - point1[0]) * Math.PI / 180;
  const Δλ = (point2[1] - point1[1]) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate centroid of a cluster of points
 */
function calculateCentroid(points) {
  const sum = points.reduce((acc, point) => {
    return [acc[0] + point[0], acc[1] + point[1]];
  }, [0, 0]);

  return [sum[0] / points.length, sum[1] / points.length];
}

/**
 * Calculate bounding box for a cluster
 */
function calculateBoundingBox(points) {
  const lats = points.map(p => p[0]);
  const lngs = points.map(p => p[1]);

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

/**
 * Convert MongoDB documents to DBSCAN format
 * MongoDB: { location: { coordinates: [lng, lat] }, ... }
 * DBSCAN: [[lat, lng], [lat, lng], ...]
 */
function prepareDataForClustering(documents) {
  return {
    points: documents.map(doc => [
      doc.location.coordinates[1], // lat
      doc.location.coordinates[0]  // lng
    ]),
    metadata: documents.map(doc => ({
      id: doc._id,
      signalStrength: doc.signalStrength,
      provider: doc.provider,
      networkType: doc.networkType,
      timestamp: doc.timestamp,
      rsrp: doc.rsrp,
      rsrq: doc.rsrq,
      connectivityFlag: doc.connectivityFlag,
      location: doc.location,
    }))
  };
}

/**
 * Core DBSCAN clustering function
 * @param {Array} data - MongoDB documents
 * @param {Number} epsilon - Distance threshold in meters (default: 300m)
 * @param {Number} minPoints - Minimum points per cluster (default: 10)
 * @returns {Object} - Clustered data with centroids and statistics
 */
exports.performDBSCAN = (data, epsilon = 300, minPoints = 10) => {
  if (!data || data.length === 0) {
    return {
      clusters: [],
      noise: [],
      stats: { totalClusters: 0, totalNoise: 0, totalPoints: 0 }
    };
  }

  const { points, metadata } = prepareDataForClustering(data);

  // Initialize DBSCAN with custom distance function
  const dbscan = new DBSCAN();
  
  // Run clustering - epsilon is in meters, haversineDistance returns meters
  const clusters = dbscan.run(points, epsilon, minPoints, haversineDistance);
  const noise = dbscan.noise || [];

  // Enrich clusters with metadata
  const enrichedClusters = clusters.map((clusterIndices, clusterId) => {
    const clusterPoints = clusterIndices.map(idx => points[idx]);
    const clusterMetadata = clusterIndices.map(idx => metadata[idx]);

    // Calculate aggregate metrics
    const avgSignalStrength = clusterMetadata.reduce((sum, m) => sum + m.signalStrength, 0) / clusterMetadata.length;
    const providers = [...new Set(clusterMetadata.map(m => m.provider))];
    const networkTypes = [...new Set(clusterMetadata.map(m => m.networkType))];
    
    // RSRP statistics (filter out nulls)
    const rsrpValues = clusterMetadata.filter(m => m.rsrp !== null).map(m => m.rsrp);
    const avgRSRP = rsrpValues.length > 0 
      ? rsrpValues.reduce((sum, val) => sum + val, 0) / rsrpValues.length 
      : null;

    return {
      id: clusterId,
      pointCount: clusterIndices.length,
      centroid: {
        lat: calculateCentroid(clusterPoints)[0],
        lng: calculateCentroid(clusterPoints)[1],
      },
      boundingBox: calculateBoundingBox(clusterPoints),
      metrics: {
        avgSignalStrength: Math.round(avgSignalStrength * 100) / 100,
        minSignalStrength: Math.min(...clusterMetadata.map(m => m.signalStrength)),
        maxSignalStrength: Math.max(...clusterMetadata.map(m => m.signalStrength)),
        avgRSRP: avgRSRP ? Math.round(avgRSRP * 100) / 100 : null,
      },
      providers,
      networkTypes,
      points: clusterMetadata, // Full metadata for each point
    };
  });

  // Noise points (outliers)
  const noisePoints = noise.map(idx => metadata[idx]);

  return {
    clusters: enrichedClusters,
    noise: noisePoints,
    stats: {
      totalClusters: clusters.length,
      totalNoise: noise.length,
      totalPoints: data.length,
      clusteringRate: ((data.length - noise.length) / data.length * 100).toFixed(2) + '%',
    }
  };
};

/**
 * Cluster dead zones (connectivityFlag = false)
 */
exports.clusterDeadZones = (data, epsilon = 400, minPoints = 5) => {
  // Filter for dead zones only
  const deadZoneData = data.filter(doc => doc.connectivityFlag === false);
  
  const result = exports.performDBSCAN(deadZoneData, epsilon, minPoints);
  
  // Sort clusters by size (largest first)
  result.clusters.sort((a, b) => b.pointCount - a.pointCount);
  
  return result;
};

/**
 * Cluster by signal quality level
 * @param {String} qualityLevel - 'excellent', 'good', 'poor', 'very_poor'
 */
exports.clusterBySignalQuality = (data, qualityLevel, epsilon = 300, minPoints = 10) => {
  // Signal quality thresholds aligned with the system-wide definitions
  // (networkController.js classifySignalQuality, theme.js SIGNAL_THRESHOLDS)
  const qualityRanges = {
    excellent: { min: -85, max: 0 },      // > -85 dBm
    good:      { min: -95, max: -85 },    // -95 < signal <= -85
    fair:      { min: -105, max: -95 },   // -105 < signal <= -95
    poor:      { min: -115, max: -105 },  // -115 < signal <= -105
    very_poor: { min: -200, max: -115 },  // <= -115 dBm
  };

  const range = qualityRanges[qualityLevel];
  if (!range) {
    throw new Error('Invalid quality level. Use: excellent, good, fair, poor, very_poor');
  }

  const filteredData = data.filter(doc => 
    doc.signalStrength > range.min && doc.signalStrength <= range.max
  );

  const result = exports.performDBSCAN(filteredData, epsilon, minPoints);
  result.qualityLevel = qualityLevel;
  
  return result;
};

/**
 * Cluster by specific provider
 */
exports.clusterByProvider = (data, provider, epsilon = 300, minPoints = 10) => {
  const providerData = data.filter(doc => doc.provider === provider);
  
  const result = exports.performDBSCAN(providerData, epsilon, minPoints);
  result.provider = provider;
  
  return result;
};

/**
 * Find anomalies (noise points that don't belong to any cluster)
 */
exports.findAnomalies = (data, epsilon = 300, minPoints = 10) => {
  const result = exports.performDBSCAN(data, epsilon, minPoints);
  
  return {
    anomalies: result.noise,
    count: result.noise.length,
    percentage: ((result.noise.length / data.length) * 100).toFixed(2) + '%',
    stats: result.stats,
  };
};
