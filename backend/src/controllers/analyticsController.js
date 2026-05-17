const NetworkData = require("../models/NetworkData");

exports.providerComparison = async (req, res) => {
  try {
    const PROVIDER_CANONICAL = { mtn: 'MTN', airtel: 'Airtel', glo: 'Glo', '9mobile': '9mobile' };

    const result = await NetworkData.aggregate([
      {
        $addFields: { _providerKey: { $toLower: '$provider' } }
      },
      {
        $group: {
          _id: '$_providerKey',
          averageSignal: { $avg: '$signalStrength' },
          totalSamples: { $sum: 1 }
        }
      },
      {
        $project: {
          provider: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 'mtn'] },     then: 'MTN'     },
                { case: { $eq: ['$_id', 'airtel'] },  then: 'Airtel'  },
                { case: { $eq: ['$_id', 'glo'] },     then: 'Glo'     },
                { case: { $eq: ['$_id', '9mobile'] }, then: '9mobile' },
              ],
              default: '$_id'
            }
          },
          averageSignal: { $round: ['$averageSignal', 2] },
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
        $addFields: { _providerKey: { $toLower: '$provider' } }
      },
      {
        $group: {
          _id: '$_providerKey',
          totalSamples: { $sum: 1 },
          blackoutSamples: {
            $sum: { $cond: [{ $eq: ['$connectivityFlag', false] }, 1, 0] }
          },
          averageSignal: { $avg: '$signalStrength' },
        }
      },
      {
        $project: {
          _id: 0,
          provider: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 'mtn'] },     then: 'MTN'     },
                { case: { $eq: ['$_id', 'airtel'] },  then: 'Airtel'  },
                { case: { $eq: ['$_id', 'glo'] },     then: 'Glo'     },
                { case: { $eq: ['$_id', '9mobile'] }, then: '9mobile' },
              ],
              default: '$_id'
            }
          },
          totalSamples: 1,
          blackoutSamples: 1,
          averageSignal: { $round: ['$averageSignal', 2] },
          blackoutRate: {
            $round: [
              { $multiply: [{ $divide: ['$blackoutSamples', '$totalSamples'] }, 100] },
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