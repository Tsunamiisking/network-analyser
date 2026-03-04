const NetworkData = require("../models/NetworkData");

exports.providerComparison = async (req, res) => {
  try {
    const result = await NetworkData.aggregate([
      {
        $group: {
          _id: "$provider",
          averageSignal: { $avg: "$signalStrength" },
          totalSamples: { $sum: 1 }
        }
      },
      {
        $project: {
          provider: "$_id",
          averageSignal: { $round: ["$averageSignal", 2] },
          totalSamples: 1,
          _id: 0
        }
      },
      {
        $sort: { averageSignal: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};