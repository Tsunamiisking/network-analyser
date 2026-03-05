const mongoose = require("mongoose");

const NetworkDataSchema = new mongoose.Schema({
  provider: String,
  signalStrength: Number,
  networkType: String,

  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: [Number]
  },

  geohash: String,

  timestamp: {
    type: Date,
    default: Date.now
  }
});

NetworkDataSchema.index({ location: "2dsphere" });
NetworkDataSchema.index({ geohash: 1 });

module.exports = mongoose.model("NetworkData", NetworkDataSchema);