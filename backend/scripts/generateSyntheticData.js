const mongoose = require("mongoose");
const NetworkData = require("../src/models/NetworkData");
const ngeohash = require("ngeohash");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI);

const providers = ["MTN", "Airtel", "Glo", "9mobile"];
const networkTypes = ["3G", "4G", "5G"];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

async function generateData(count = 10000) {

  const data = [];

  for (let i = 0; i < count; i++) {

    // Lagos coordinate bounds
    const latitude = randomBetween(6.40, 6.70);
    const longitude = randomBetween(3.20, 3.50);

    const signalStrength = Math.floor(randomBetween(-110, -50));

    const provider = providers[Math.floor(Math.random() * providers.length)];

    const networkType = networkTypes[Math.floor(Math.random() * networkTypes.length)];

    const geohash = ngeohash.encode(latitude, longitude, 6);

    data.push({
      signalStrength,
      provider,
      networkType,
      geohash,
      location: {
        type: "Point",
        coordinates: [longitude, latitude]
      },
      timestamp: new Date()
    });

  }

  await NetworkData.insertMany(data);

  console.log(`Inserted ${count} synthetic records`);

  process.exit();
}

generateData(10000);