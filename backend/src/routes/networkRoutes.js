const express = require("express");
const router = express.Router();
const {createNetworkData, getHeatmapData, getAggregatedHeatmapData, bestAggregatedNetwork} = require("../controllers/networkController");

router.post("/", createNetworkData);
router.get("/heatmap", getHeatmapData);
router.get("/heatmap/aggregated", getAggregatedHeatmapData);
router.get("/best", bestAggregatedNetwork);

module.exports = router;