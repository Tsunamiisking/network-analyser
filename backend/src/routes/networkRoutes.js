const express = require("express");
const router = express.Router();
const {
  createNetworkData, 
  getHeatmapData, 
  getAggregatedHeatmapData, 
  bestAggregatedNetwork,
  getDeadZones
} = require("../controllers/networkController");

router.post("/", createNetworkData);
router.get("/heatmap", getHeatmapData);
router.get("/heatmap/aggregated", getAggregatedHeatmapData);
router.get("/best", bestAggregatedNetwork);
router.get("/deadzones", getDeadZones);

module.exports = router;