const NetworkData = require("../models/NetworkData");
const ngeohash = require("ngeohash");
const redisClient = require("../config/redis");

const CACHE_TTL = 300; // 5 minutes

exports.createNetworkData = async (req, res) => {
  try {
    const {
      signalStrength,
      provider,
      networkType,
      latitude,
      longitude,
      rsrp,
      rsrq,
      connectivityFlag,
      deviceId,
    } = req.body;

    if (
      signalStrength === undefined ||
      !provider ||
      !networkType ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Spatial plausibility check — reject coordinates outside Nigeria bounding box
    if (lat < 4.0 || lat > 14.0 || lng < 2.6 || lng > 15.0) {
      return res.status(400).json({ message: "Coordinates outside valid geographic range" });
    }

    // RSRP range validation per 3GPP spec (-44 dBm to -140 dBm)
    if (rsrp !== undefined && rsrp !== null && (rsrp > -44 || rsrp < -140)) {
      return res.status(400).json({ message: "RSRP value outside physically valid range (-44 to -140 dBm)" });
    }

    const geohash = ngeohash.encode(lat, lng, 6);

    const newEntry = await NetworkData.create({
      signalStrength,
      provider,
      networkType,
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },
      geohash,
      rsrp: rsrp !== undefined && rsrp !== null ? parseFloat(rsrp) : null,
      rsrq: rsrq !== undefined && rsrq !== null ? parseFloat(rsrq) : null,
      connectivityFlag: connectivityFlag !== undefined ? Boolean(connectivityFlag) : true,
      deviceId: deviceId || null,
    });

    res.status(201).json({
      success: true,
      message: "Network data created successfully",
      data: newEntry,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getHeatmapData = async (req, res) => {
  try {
    const { provider, startDate, endDate, minLat, maxLat, minLng, maxLng } =
      req.query;

    // Generate cache key from query params
    const cacheKey = `heatmap:${JSON.stringify(req.query)}`;

    // Check Redis cache
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
      // Continue to MongoDB if Redis fails
    }

    let filter = {};

    // Provider filter
    if (provider) {
      filter.provider = provider;
    }

    // Time range filter
    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Bounding box filter
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

    const data = await NetworkData.find(filter)
      .select("signalStrength location provider networkType timestamp")
      .limit(5000); // safety limit

    const response = {
      success: true,
      count: data.length,
      data,
      cached: false,
    };

    // Save to Redis cache for 5 minutes
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (redisError) {
      console.error("Redis cache save error:", redisError);
      // Continue even if caching fails
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAggregatedHeatmapData = async (req, res) => {
  try {
    const {
      provider,
      startDate,
      endDate,
      minLat,
      maxLat,
      minLng,
      maxLng,
      precision,
    } = req.query;

    // Generate cache key from query params
    const cacheKey = `heatmap:aggregated:${JSON.stringify(req.query)}`;

    // Check Redis cache
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
      // Continue to MongoDB if Redis fails
    }

    let matchStage = {};

    // Provider filter
    if (provider) {
      matchStage.provider = provider;
    }

    // Time range filter
    if (startDate && endDate) {
      matchStage.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Bounding box filter
    if (minLat && maxLat && minLng && maxLng) {
      matchStage.location = {
        $geoWithin: {
          $box: [
            [parseFloat(minLng), parseFloat(minLat)],
            [parseFloat(maxLng), parseFloat(maxLat)],
          ],
        },
      };
    }

    // Use geohash precision to control clustering level
    // Higher precision = more granular (4=~20km, 5=~5km, 6=~1.2km)
    const geohashPrecision = parseInt(precision) || 5;

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $substr: ["$geohash", 0, geohashPrecision] },
          // Collect all signal strength values for median calculation
          signalStrengths: { $push: "$signalStrength" },
          minSignalStrength: { $min: "$signalStrength" },
          maxSignalStrength: { $max: "$signalStrength" },
          count: { $sum: 1 },
          providers: { $addToSet: "$provider" },
          networkTypes: { $addToSet: "$networkType" },
        },
      },
      {
        $project: {
          _id: 0,
          geohash: "$_id",
          signalStrengths: 1,
          minSignalStrength: 1,
          maxSignalStrength: 1,
          count: 1,
          providers: 1,
          networkTypes: 1,
          // Calculate signal variance (max - min) for data quality indicator
          signalVariance: { $subtract: ["$maxSignalStrength", "$minSignalStrength"] }
        },
      },
      { $sort: { count: -1 } },
    ];

    const data = await NetworkData.aggregate(pipeline);

    // Calculate median in JavaScript (more reliable than MongoDB aggregation)
    const enrichedData = data.map((item) => {
      // Calculate median from sorted array
      const sorted = item.signalStrengths.sort((a, b) => a - b);
      const len = sorted.length;
      const medianSignalStrength = len % 2 === 0
        ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2  // Even: average of two middle values
        : sorted[Math.floor(len / 2)];                  // Odd: middle value
      
      const decoded = ngeohash.decode(item.geohash);
      
      // Remove signalStrengths array from response (not needed by frontend)
      delete item.signalStrengths;
      
      return {
        ...item,
        medianSignalStrength: Math.round(medianSignalStrength * 100) / 100,
        location: {
          type: "Point",
          coordinates: [decoded.longitude, decoded.latitude],
        },
      };
    });

    const response = {
      success: true,
      count: enrichedData.length,
      precision: geohashPrecision,
      data: enrichedData,
      cached: false,
    };

    // Save to Redis cache for 5 minutes
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (redisError) {
      console.error("Redis cache save error:", redisError);
      // Continue even if caching fails
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.bestAggregatedNetwork = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    // Validate required parameters
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false,
        message: "Missing required parameters: lat and lng" 
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const maxDistance = parseInt(radius) || 2000; // default 2km

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid coordinates" 
      });
    }

    // Generate cache key from query params
    const cacheKey = `best:${latitude}:${longitude}:${maxDistance}`;

    // Check Redis cache
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
      // Continue to MongoDB if Redis fails
    }

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true,
          key: "location" // specify the geospatial index field
        }
      },
      {
        $group: {
          _id: "$provider",
          avgSignalStrength: { $avg: "$signalStrength" },
          minSignalStrength: { $min: "$signalStrength" },
          maxSignalStrength: { $max: "$signalStrength" },
          count: { $sum: 1 },
          avgDistance: { $avg: "$distance" },
          networkTypes: { $addToSet: "$networkType" }
        }
      },
      {
        $project: {
          _id: 0,
          provider: "$_id",
          avgSignalStrength: { $round: ["$avgSignalStrength", 2] },
          minSignalStrength: 1,
          maxSignalStrength: 1,
          count: 1,
          avgDistance: { $round: ["$avgDistance", 2] },
          networkTypes: 1
        }
      },
      {
        $sort: { avgSignalStrength: -1 }
      }
    ];

    const data = await NetworkData.aggregate(pipeline);

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No network data found within ${maxDistance}m of the specified location`
      });
    }

    // Signal quality classification
    const classifySignalQuality = (avgSignal) => {
      if (avgSignal > -85) return { level: 'excellent', label: 'Excellent' };
      if (avgSignal > -95) return { level: 'good', label: 'Good' };
      if (avgSignal > -105) return { level: 'fair', label: 'Fair' };
      if (avgSignal > -115) return { level: 'poor', label: 'Poor' };
      return { level: 'very_poor', label: 'Very Poor' };
    };

    // Add quality classification to all providers
    const enrichedData = data.map(provider => ({
      ...provider,
      quality: classifySignalQuality(provider.avgSignalStrength)
    }));

    // Check if best network meets minimum quality threshold (-105 dBm)
    const MINIMUM_QUALITY_THRESHOLD = -105;
    const bestProvider = enrichedData[0];
    const isQualityAcceptable = bestProvider.avgSignalStrength > MINIMUM_QUALITY_THRESHOLD;

    const response = {
      success: true,
      location: {
        type: "Point",
        coordinates: [longitude, latitude]
      },
      radius: maxDistance,
      bestProvider: bestProvider,
      allProviders: enrichedData,
      qualityWarning: !isQualityAcceptable 
        ? `Limited data available - best network has ${bestProvider.quality.label.toLowerCase()} signal (${bestProvider.avgSignalStrength} dBm)` 
        : null,
      cached: false
    };

    // Save to Redis cache for 5 minutes
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (redisError) {
      console.error("Redis cache save error:", redisError);
      // Continue even if caching fails
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

exports.getDeadZones = async (req, res) => {
  try {
    const { provider, minLat, maxLat, minLng, maxLng, precision } = req.query;

    // Generate cache key from query params
    const cacheKey = `deadzones:${JSON.stringify(req.query)}`;

    // Check Redis cache
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

    let matchStage = {
      connectivityFlag: false // Only areas with NO connectivity
    };

    // Provider filter
    if (provider) {
      matchStage.provider = provider;
    }

    // Bounding box filter
    if (minLat && maxLat && minLng && maxLng) {
      matchStage.location = {
        $geoWithin: {
          $box: [
            [parseFloat(minLng), parseFloat(minLat)],
            [parseFloat(maxLng), parseFloat(maxLat)],
          ],
        },
      };
    }

    const geohashPrecision = parseInt(precision) || 5;

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $substr: ["$geohash", 0, geohashPrecision] },
          count: { $sum: 1 },
          providers: { $addToSet: "$provider" },
          networkTypes: { $addToSet: "$networkType" }
        }
      },
      {
        $project: {
          _id: 0,
          geohash: "$_id",
          count: 1,
          providers: 1,
          networkTypes: 1
        }
      },
      { $sort: { count: -1 } }
    ];

    const data = await NetworkData.aggregate(pipeline);

    // Decode geohash to get center coordinates
    const enrichedData = data.map((item) => {
      const decoded = ngeohash.decode(item.geohash);
      return {
        ...item,
        location: {
          type: "Point",
          coordinates: [decoded.longitude, decoded.latitude],
        },
      };
    });

    const response = {
      success: true,
      count: enrichedData.length,
      precision: geohashPrecision,
      data: enrichedData,
      cached: false
    };

    // Save to Redis cache for 5 minutes
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
      message: "Server error" 
    });
  }
};

// GET /api/networks/history?deviceId=xxx&limit=50
// Returns a single device's own telemetry history, most recent first.
// Used by the mobile app "My Signal History" screen.
exports.getMyHistory = async (req, res) => {
  try {
    const { deviceId, limit } = req.query;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const records = await NetworkData.find({ deviceId })
      .select("signalStrength provider networkType connectivityFlag location timestamp")
      .sort({ timestamp: -1 })
      .limit(parseInt(limit) || 50);

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
