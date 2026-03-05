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