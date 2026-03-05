const NetworkData = require("../models/NetworkData");
const ngeohash = require("ngeohash");

exports.createNetworkData = async (req, res) => {
  try {
    const { signalStrength, provider, networkType, latitude, longitude } = req.body;
    const geohash = ngeohash.encode(latitude, longitude, 6);
    if (
      signalStrength === undefined ||
      !provider ||
      !networkType ||
      !latitude ||
      !longitude
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newEntry = await NetworkData.create({
      signalStrength,
      provider,
      networkType,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      geohash,
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
    const { provider, startDate, endDate, minLat, maxLat, minLng, maxLng } = req.query;

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

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAggregatedHeatmapData = async (req, res) => {
  try {
    const { provider, startDate, endDate, minLat, maxLat, minLng, maxLng, precision } = req.query;

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
          avgSignalStrength: { $avg: "$signalStrength" },
          minSignalStrength: { $min: "$signalStrength" },
          maxSignalStrength: { $max: "$signalStrength" },
          count: { $sum: 1 },
          providers: { $addToSet: "$provider" },
          networkTypes: { $addToSet: "$networkType" }
        }
      },
      {
        $project: {
          _id: 0,
          geohash: "$_id",
          avgSignalStrength: { $round: ["$avgSignalStrength", 2] },
          minSignalStrength: 1,
          maxSignalStrength: 1,
          count: 1,
          providers: 1,
          networkTypes: 1
        }
      },
      { $sort: { count: -1 } }
    ];

    const data = await NetworkData.aggregate(pipeline);

    // Decode geohash to get center coordinates for each cluster
    const enrichedData = data.map(item => {
      const decoded = ngeohash.decode(item.geohash);
      return {
        ...item,
        location: {
          type: "Point",
          coordinates: [decoded.longitude, decoded.latitude]
        }
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      precision: geohashPrecision,
      data: enrichedData,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};