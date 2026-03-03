const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ["MTN", "Airtel", "Glo", "9mobile"],
    },

    issueType: {
      type: String,
      required: true,
      enum: ["No Signal", "Slow Internet", "Call Drop", "No Data"],
    },

    description: {
      type: String,
      trim: true,
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

reportSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Report", reportSchema);