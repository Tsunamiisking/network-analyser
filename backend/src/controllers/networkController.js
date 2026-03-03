const NetworkData = require("../models/NetworkData");

exports.createNetworkData = async (req, res) => {
  try {
    const { signalStrength, provider, networkType, latitude, longitude } = req.body;

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
    const { provider, startDate, endDate } = req.query;

    let filter = {};

    if (provider) {
      filter.provider = provider;
    }

    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const data = await NetworkData.find(filter).select(
      "signalStrength location provider networkType timestamp"
    );

    res.status(200).json({
      success: true,
      message: "Network data retrieved successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}; 