const express = require("express");
const router = express.Router();
const {createNetworkData, getHeatmapData} = require("../controllers/networkController");

router.post("/", createNetworkData);
router.get("/heatmap", getHeatmapData);

module.exports = router;