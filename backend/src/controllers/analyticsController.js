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
exports.blackoutRate = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};

    if (startDate && endDate) {
      matchStage.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const result = await NetworkData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$provider",
          totalSamples: { $sum: 1 },
          blackoutSamples: {
            $sum: { $cond: [{ $eq: ["$connectivityFlag", false] }, 1, 0] }
          },
          averageSignal: { $avg: "$signalStrength" },
        }
      },
      {
        $project: {
          _id: 0,
          provider: "$_id",
          totalSamples: 1,
          blackoutSamples: 1,
          averageSignal: { $round: ["$averageSignal", 2] },
          blackoutRate: {
            $round: [
              { $multiply: [{ $divide: ["$blackoutSamples", "$totalSamples"] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { blackoutRate: -1 } }
    ]);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};