const express = require("express");
const router = express.Router();
const {providerComparison, blackoutRate} = require("../controllers/analyticsController");

router.get("/provider-comparison", providerComparison);
router.get("/blackout-rate", blackoutRate);

module.exports = router;