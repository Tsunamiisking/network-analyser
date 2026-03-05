const express = require("express");
const router = express.Router();
const {createNetworkData, getHeatmapData, getAggregatedHeatmapData} = require("../controllers/networkController");

router.post("/", createNetworkData);
router.get("/heatmap", getHeatmapData);
router.get("/heatmap/aggregated", getAggregatedHeatmapData);

module.exports = router;