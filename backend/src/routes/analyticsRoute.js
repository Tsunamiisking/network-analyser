const express = require("express");
const router = express.Router();
const {providerComparison} = require("../controllers/analyticsController");

router.get("/provider-comparison", providerComparison);

module.exports = router;