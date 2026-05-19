/**
 * generateSyntheticData.js — Synthetic Data Generator (Random)
 *
 * Simple seed script that inserts a configurable number of uniformly random
 * network measurement records into the MongoDB `networkdatas` collection.
 * Coordinates are sampled uniformly across the Lagos bounding box
 * (lat 6.40–6.70, lng 3.20–3.50). Signal strength is random in [−110, −50] dBm.
 * Provider and network type are chosen at random from the four Nigerian carriers
 * and three generations (3G/4G/5G). Unlike generateClusteredData.js, this script
 * does NOT clear existing data before inserting.
 * Default count: 10,000 records.
 * Run with: node scripts/generateSyntheticData.js
 */
const mongoose = require("mongoose");
const NetworkData = require("../src/models/NetworkData");
const ngeohash = require("ngeohash");
require("dotenv").config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'network-analyser-db';

mongoose.connect(uri, { dbName });

const providers = ["MTN", "Airtel", "Glo", "9mobile"];
const networkTypes = ["3G", "4G", "5G"];

// Lagos areas for generating realistic location names
const lagosAreas = [
  "Victoria Island", "Lekki", "Yaba", "Ikoyi", "Surulere", 
  "Ikeja", "Ajah", "Marina", "Ebute Metta", "Mushin",
  "Lagos Island", "Apapa", "Festac", "Maryland", "Gbagada",
  "Obalende", "Banana Island", "Oshodi", "Isolo", "Ejigbo"
];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function getRandomArea() {
  return lagosAreas[Math.floor(Math.random() * lagosAreas.length)] + ", Lagos";
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

    const locationName = getRandomArea();

    data.push({
      signalStrength,
      provider,
      networkType,
      geohash,
      locationName,
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