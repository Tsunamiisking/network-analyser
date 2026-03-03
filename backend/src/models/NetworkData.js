const mongoose = require("mongoose");

const networkDataSchema = new mongoose.Schema(
  {
    signalStrength: {
      type: Number,
      required: true,
    },

    provider: {
      type: String,
      required: true,
      enum: ["MTN", "Airtel", "Glo", "9mobile"],
    },

    networkType: {
      type: String,
      required: true,
      enum: ["2G", "3G", "4G", "5G"],
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

networkDataSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("NetworkData", networkDataSchema);