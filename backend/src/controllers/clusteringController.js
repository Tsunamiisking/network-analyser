const NetworkData = require("../models/NetworkData");
const clusteringService = require("../services/clusteringService");
const redisClient = require("../config/redis");

const CACHE_TTL = 600; // 10 minutes for clustering results (more expensive computation)

/**
 * GET /api/clustering/deadzones
 * Find clusters of dead zones using DBSCAN
 */
exports.getDeadZoneClusters = async (req, res) => {
  try {
    const { 
      provider, 
      startDate, 
      endDate, 
      minLat, 
      maxLat, 
      minLng, 
      maxLng,
      epsilon = 400,  // 400m default for dead zones (larger radius)
      minPoints = 5    // Lower threshold for dead zones
    } = req.query;

    // Generate cache key
    const cacheKey = `clustering:deadzones:${JSON.stringify(req.query)}`;

    // Check cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.status(200).json({
          ...JSON.parse(cachedData),
          cached: true,
        });
      }
    } catch (redisError) {
      console.error("Redis error:", redisError);
    }

    // Build filter for dead zones
    let filter = {
      connectivityFlag: false  // Only dead zones
    };

    if (provider) filter.provider = provider;

    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (minLat && maxLat && minLng && maxLng) {
      filter.location = {
        $geoWithin: {
          $box: [
            [parseFloat(minLng), parseFloat(minLat)],
            [parseFloat(maxLng), parseFloat(maxLat)],
          ],
        },
      };
    }

    // Fetch data
    const data = await NetworkData.find(filter).limit(10000);

    if (data.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No dead zones found",
        clusters: [],
        noise: [],
        stats: { totalClusters: 0, totalNoise: 0, totalPoints: 0 }
      });
    }

    // Perform DBSCAN clustering
    const result = clusteringService.clusterDeadZones(
      data, 
      parseFloat(epsilon), 
      parseInt(minPoints)
    );

    const response = {
      success: true,
      method: 'DBSCAN',
      parameters: {
        epsilon: parseFloat(epsilon),
        minPoints: parseInt(minPoints),
      },
      ...result,
      cached: false,
    };

    // Cache result
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (redisError) {
      console.error("Redis cache save error:", redisError);
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
};

/**
 * GET /api/clustering/signal-quality
 * Find clusters by signal quality level
 */
exports.getSignalQualityClusters = async (req, res) => {
  try {
    const { 
      qualityLevel = 'poor',  // excellent, good, fair, poor, very_poor
      provider,
      startDate,
      endDate,
      minLat,
      maxLat,
      minLng,
      maxLng,
      epsilon = 300,
      minPoints = 10
    } = req.query;

    // Generate cache key
    const cacheKey = `clustering:quality:${JSON.stringify(req.query)}`;

    // Check cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.status(200).json({
          ...JSON.parse(cachedData),
          cached: true,
        });
      }
    } catch (redisError) {
      console.error("Redis error:", redisError);
    }

    // Build filter
    let filter = {};

    if (provider) filter.provider = provider;

    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (minLat && maxLat && minLng && maxLng) {
      filter.location = {
        $geoWithin: {
          $box: [
            [parseFloat(minLng), parseFloat(minLat)],
            [parseFloat(maxLng), parseFloat(maxLat)],
          ],
        },
      };
    }

    // Fetch data
    const data = await NetworkData.find(filter).limit(10000);

    if (data.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No data found",
        clusters: [],
        noise: [],
        stats: { totalClusters: 0, totalNoise: 0, totalPoints: 0 }
      });
    }

    // Perform clustering by quality
    const result = clusteringService.clusterBySignalQuality(
      data,
      qualityLevel,
      parseFloat(epsilon),
      parseInt(minPoints)
    );

    const response = {
      success: true,
      method: 'DBSCAN',
      parameters: {
        qualityLevel,
        epsilon: parseFloat(epsilon),
        minPoints: parseInt(minPoints),
      },
      ...result,
      cached: false,
    };

    // Cache result
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (redisError) {
      console.error("Redis cache save error:", redisError);
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
};

/**
 * GET /api/clustering/provider/:provider
 * Analyze coverage clusters for a specific provider
 */
exports.getProviderClusters = async (req, res) => {
  try {
    const { provider } = req.params;
    const {
      startDate,
      endDate,
      minLat,
      maxLat,
      minLng,
      maxLng,
      epsilon = 300,
      minPoints = 10
    } = req.query;

    // Validate provider
    const validProviders = ['MTN', 'Airtel', 'Glo', '9mobile'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: `Invalid provider. Must be one of: ${validProviders.join(', ')}`
      });
    }

    // Generate cache key
    const cacheKey = `clustering:provider:${provider}:${JSON.stringify(req.query)}`;

    // Check cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.status(200).json({
          ...JSON.parse(cachedData),
          cached: true,
        });
      }
    } catch (redisError) {
      console.error("Redis error:", redisError);
    }

    // Build filter
    let filter = { provider };

    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (minLat && maxLat && minLng && maxLng) {
      filter.location = {
        $geoWithin: {
          $box: [
            [parseFloat(minLng), parseFloat(minLat)],
            [parseFloat(maxLng), parseFloat(maxLat)],
          ],
        },
      };
    }

    // Fetch data
    const data = await NetworkData.find(filter).limit(10000);

    if (data.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No data found for ${provider}`,
        clusters: [],
        noise: [],
        stats: { totalClusters: 0, totalNoise: 0, totalPoints: 0 }
      });
    }

    // Perform clustering
    const result = clusteringService.clusterByProvider(
      data,
      provider,
      parseFloat(epsilon),
      parseInt(minPoints)
    );

    const response = {
      success: true,
      method: 'DBSCAN',
      parameters: {
        provider,
        epsilon: parseFloat(epsilon),
        minPoints: parseInt(minPoints),
      },
      ...result,
      cached: false,
    };

    // Cache result
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (redisError) {
      console.error("Redis cache save error:", redisError);
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
};

/**
 * GET /api/clustering/anomalies
 * Detect outlier/anomalous measurements
 */
exports.getAnomalies = async (req, res) => {
  try {
    const {
      provider,
      startDate,
      endDate,
      minLat,
      maxLat,
      minLng,
      maxLng,
      epsilon = 300,
      minPoints = 10
    } = req.query;

    // Generate cache key
    const cacheKey = `clustering:anomalies:${JSON.stringify(req.query)}`;

    // Check cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.status(200).json({
          ...JSON.parse(cachedData),
          cached: true,
        });
      }
    } catch (redisError) {
      console.error("Redis error:", redisError);
    }

    // Build filter
    let filter = {};

    if (provider) filter.provider = provider;

    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (minLat && maxLat && minLng && maxLng) {
      filter.location = {
        $geoWithin: {
          $box: [
            [parseFloat(minLng), parseFloat(minLat)],
            [parseFloat(maxLng), parseFloat(maxLat)],
          ],
        },
      };
    }

    // Fetch data
    const data = await NetworkData.find(filter).limit(10000);

    if (data.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No data found",
        anomalies: [],
        count: 0,
        percentage: '0%'
      });
    }

    // Find anomalies
    const result = clusteringService.findAnomalies(
      data,
      parseFloat(epsilon),
      parseInt(minPoints)
    );

    const response = {
      success: true,
      method: 'DBSCAN',
      parameters: {
        epsilon: parseFloat(epsilon),
        minPoints: parseInt(minPoints),
      },
      ...result,
      cached: false,
    };

    // Cache result
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (redisError) {
      console.error("Redis cache save error:", redisError);
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
};
