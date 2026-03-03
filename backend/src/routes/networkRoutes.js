const express = require("express");
const router = express.Router();
const networkController = require("../controllers/networkController");

router.post("/", networkController.createNetworkData);
// router.get("/heatmap", networkController.getHeatmapData);

module.exports = router;