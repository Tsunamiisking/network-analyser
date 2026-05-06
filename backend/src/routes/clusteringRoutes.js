const express = require("express");
const router = express.Router();
const {
  getDeadZoneClusters,
  getSignalQualityClusters,
  getProviderClusters,
  getAnomalies
} = require("../controllers/clusteringController");

// DBSCAN-based clustering endpoints

// Dead zone clustering (connectivityFlag = false)
router.get("/deadzones", getDeadZoneClusters);

// Signal quality clustering (excellent/good/fair/poor/very_poor)
router.get("/signal-quality", getSignalQualityClusters);

// Provider-specific analysis
router.get("/provider/:provider", getProviderClusters);

// Anomaly detection (outliers)
router.get("/anomalies", getAnomalies);

module.exports = router;
