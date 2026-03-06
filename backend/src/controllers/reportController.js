const Report = require("../models/Report");
const redisClient = require("../config/redis");

const CACHE_TTL = 300; // 5 minutes

// POST /api/reports
// Accepts manual outage reports from both Android and iOS clients.
// Reports are accepted even when submitted after a connectivity restoration
// (the mobile client queues them locally and uploads when back online).
exports.submitReport = async (req, res) => {
  try {
    const { provider, issueType, description, latitude, longitude } = req.body;

    if (!provider || !issueType || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Spatial plausibility check — same Nigeria bounding box as telemetry pipeline
    if (lat < 4.0 || lat > 14.0 || lng < 2.6 || lng > 15.0) {
      return res.status(400).json({ message: "Coordinates outside valid geographic range" });
    }

    const newReport = await Report.create({
      provider,
      issueType,
      description: description || "",
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      data: newReport,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/reports
// Returns reports within an optional bounding box and/or provider filter.
// Used by the web dashboard to overlay user-confirmed outage markers on the heatmap.
exports.getReports = async (req, res) => {
  try {
    const { provider, minLat, maxLat, minLng, maxLng, startDate, endDate } = req.query;

    // Generate cache key from query params
    const cacheKey = `reports:${JSON.stringify(req.query)}`;

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

    const reports = await Report.find(filter)
      .select("provider issueType description location timestamp")
      .sort({ timestamp: -1 })
      .limit(1000);

    const response = {
      success: true,
      count: reports.length,
      data: reports,
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
