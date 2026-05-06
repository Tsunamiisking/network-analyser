require("dotenv").config();
const mongoose = require("mongoose");
const NetworkData = require("../src/models/NetworkData");
const ngeohash = require("ngeohash");

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'network-analyser-db';

mongoose.connect(uri, { dbName });

const providers = ["MTN", "Airtel", "Glo", "9mobile"];
const networkTypes = ["3G", "4G", "5G"];

const lagosAreas = [
  "Victoria Island", "Lekki", "Yaba", "Ikoyi", "Surulere", 
  "Ikeja", "Ajah", "Marina", "Ebute Metta", "Mushin",
  "Lagos Island", "Apapa", "Festac", "Maryland", "Gbagada",
  "Obalende", "Banana Island", "Oshodi", "Isolo", "Ejigbo"
];

// Define cluster centers for different patterns
const CLUSTERS = {
  deadZones: [
    // Dead zone cluster 1: Mushin area (northern Lagos)
    { lat: 6.530, lng: 3.343, radius: 0.008, area: "Mushin", density: 50 },
    // Dead zone cluster 2: Apapa port area
    { lat: 6.449, lng: 3.359, radius: 0.010, area: "Apapa", density: 40 },
    // Dead zone cluster 3: Oshodi underpass
    { lat: 6.549, lng: 3.339, radius: 0.006, area: "Oshodi", density: 35 },
    // Dead zone cluster 4: Ejigbo residential
    { lat: 6.550, lng: 3.299, radius: 0.007, area: "Ejigbo", density: 30 },
  ],
  
  excellentSignal: [
    // Excellent signal cluster 1: Victoria Island (business district)
    { lat: 6.428, lng: 3.421, radius: 0.012, area: "Victoria Island", density: 80, providers: ["MTN", "Airtel"] },
    // Excellent signal cluster 2: Banana Island (premium area)
    { lat: 6.438, lng: 3.423, radius: 0.005, area: "Banana Island", density: 40, providers: ["MTN", "Glo"] },
    // Excellent signal cluster 3: Lekki Phase 1
    { lat: 6.445, lng: 3.474, radius: 0.015, area: "Lekki", density: 70, providers: ["MTN", "Airtel", "Glo"] },
  ],
  
  poorSignal: [
    // Poor signal cluster 1: Ajah (far from towers)
    { lat: 6.465, lng: 3.569, radius: 0.020, area: "Ajah", density: 60 },
    // Poor signal cluster 2: Ikorodu road corridor
    { lat: 6.600, lng: 3.350, radius: 0.018, area: "Maryland", density: 50 },
    // Poor signal cluster 3: Festac (congested area)
    { lat: 6.465, lng: 3.280, radius: 0.012, area: "Festac", density: 45 },
  ],
  
  providerSpecific: {
    // MTN strong coverage zones
    mtn: [
      { lat: 6.524, lng: 3.379, radius: 0.010, area: "Yaba", density: 50 },
      { lat: 6.601, lng: 3.351, radius: 0.008, area: "Ikeja", density: 40 },
    ],
    // Airtel strong coverage zones
    airtel: [
      { lat: 6.437, lng: 3.367, radius: 0.009, area: "Ikoyi", density: 45 },
    ],
    // Glo strong coverage zones
    glo: [
      { lat: 6.496, lng: 3.384, radius: 0.011, area: "Surulere", density: 50 },
    ],
    // 9mobile coverage zones
    "9mobile": [
      { lat: 6.454, lng: 3.391, radius: 0.007, area: "Lagos Island", density: 35 },
    ],
  }
};

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// Gaussian/normal distribution random number generator
function gaussianRandom(mean = 0, stdev = 1) {
  const u = 1 - Math.random(); // Converting [0,1) to (0,1]
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

// Generate point within cluster using normal distribution
function generateClusteredPoint(center, radiusStdev) {
  const latOffset = gaussianRandom(0, radiusStdev);
  const lngOffset = gaussianRandom(0, radiusStdev);
  
  return {
    lat: center.lat + latOffset,
    lng: center.lng + lngOffset
  };
}

// Generate dead zone data points
function generateDeadZonePoints() {
  const points = [];
  
  CLUSTERS.deadZones.forEach(cluster => {
    for (let i = 0; i < cluster.density; i++) {
      const point = generateClusteredPoint(cluster, cluster.radius);
      
      // Ensure within Nigeria bounds
      if (point.lat < 4.0 || point.lat > 14.0 || point.lng < 2.6 || point.lng > 15.0) {
        continue;
      }
      
      const geohash = ngeohash.encode(point.lat, point.lng, 6);
      
      points.push({
        signalStrength: Math.floor(randomBetween(-140, -115)), // Very weak signal
        provider: providers[Math.floor(Math.random() * providers.length)],
        networkType: networkTypes[Math.floor(Math.random() * networkTypes.length)],
        geohash,
        locationName: cluster.area + ", Lagos",
        location: {
          type: "Point",
          coordinates: [point.lng, point.lat]
        },
        connectivityFlag: false, // Dead zone
        rsrp: Math.floor(randomBetween(-140, -130)), // Very poor RSRP
        rsrq: null,
        deviceId: `device_${Math.floor(Math.random() * 100)}`,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      });
    }
  });
  
  return points;
}

// Generate excellent signal data points
function generateExcellentSignalPoints() {
  const points = [];
  
  CLUSTERS.excellentSignal.forEach(cluster => {
    for (let i = 0; i < cluster.density; i++) {
      const point = generateClusteredPoint(cluster, cluster.radius);
      
      if (point.lat < 4.0 || point.lat > 14.0 || point.lng < 2.6 || point.lng > 15.0) {
        continue;
      }
      
      const geohash = ngeohash.encode(point.lat, point.lng, 6);
      
      // Prefer specific providers for this cluster
      const provider = cluster.providers 
        ? cluster.providers[Math.floor(Math.random() * cluster.providers.length)]
        : providers[Math.floor(Math.random() * providers.length)];
      
      points.push({
        signalStrength: Math.floor(randomBetween(-65, -45)), // Excellent signal
        provider,
        networkType: Math.random() > 0.3 ? "5G" : "4G", // Mostly 5G in premium areas
        geohash,
        locationName: cluster.area + ", Lagos",
        location: {
          type: "Point",
          coordinates: [point.lng, point.lat]
        },
        connectivityFlag: true,
        rsrp: Math.floor(randomBetween(-70, -50)), // Excellent RSRP
        rsrq: Math.floor(randomBetween(-10, -5)),
        deviceId: `device_${Math.floor(Math.random() * 100)}`,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
      });
    }
  });
  
  return points;
}

// Generate poor signal data points
function generatePoorSignalPoints() {
  const points = [];
  
  CLUSTERS.poorSignal.forEach(cluster => {
    for (let i = 0; i < cluster.density; i++) {
      const point = generateClusteredPoint(cluster, cluster.radius);
      
      if (point.lat < 4.0 || point.lat > 14.0 || point.lng < 2.6 || point.lng > 15.0) {
        continue;
      }
      
      const geohash = ngeohash.encode(point.lat, point.lng, 6);
      
      points.push({
        signalStrength: Math.floor(randomBetween(-110, -95)), // Poor signal
        provider: providers[Math.floor(Math.random() * providers.length)],
        networkType: Math.random() > 0.5 ? "3G" : "4G", // Mostly 3G/4G in poor areas
        geohash,
        locationName: cluster.area + ", Lagos",
        location: {
          type: "Point",
          coordinates: [point.lng, point.lat]
        },
        connectivityFlag: true,
        rsrp: Math.floor(randomBetween(-115, -95)),
        rsrq: Math.floor(randomBetween(-15, -10)),
        deviceId: `device_${Math.floor(Math.random() * 100)}`,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
      });
    }
  });
  
  return points;
}

// Generate provider-specific coverage points
function generateProviderSpecificPoints() {
  const points = [];
  
  Object.keys(CLUSTERS.providerSpecific).forEach(providerKey => {
    const clusters = CLUSTERS.providerSpecific[providerKey];
    
    clusters.forEach(cluster => {
      for (let i = 0; i < cluster.density; i++) {
        const point = generateClusteredPoint(cluster, cluster.radius);
        
        if (point.lat < 4.0 || point.lat > 14.0 || point.lng < 2.6 || point.lng > 15.0) {
          continue;
        }
        
        const geohash = ngeohash.encode(point.lat, point.lng, 6);
        
        // This provider has good signal here
        points.push({
          signalStrength: Math.floor(randomBetween(-75, -55)), // Good signal for this provider
          provider: providerKey,
          networkType: Math.random() > 0.4 ? "4G" : "5G",
          geohash,
          locationName: cluster.area + ", Lagos",
          location: {
            type: "Point",
            coordinates: [point.lng, point.lat]
          },
          connectivityFlag: true,
          rsrp: Math.floor(randomBetween(-80, -60)),
          rsrq: Math.floor(randomBetween(-12, -7)),
          deviceId: `device_${Math.floor(Math.random() * 100)}`,
          timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
        });
        
        // Also add some competing providers with weaker signal
        if (Math.random() > 0.6) {
          const competitorProvider = providers.filter(p => p !== providerKey)[Math.floor(Math.random() * 3)];
          const competitorPoint = generateClusteredPoint(cluster, cluster.radius * 0.5);
          
          if (competitorPoint.lat >= 4.0 && competitorPoint.lat <= 14.0 && 
              competitorPoint.lng >= 2.6 && competitorPoint.lng <= 15.0) {
            points.push({
              signalStrength: Math.floor(randomBetween(-95, -75)), // Weaker for competitor
              provider: competitorProvider,
              networkType: networkTypes[Math.floor(Math.random() * networkTypes.length)],
              geohash: ngeohash.encode(competitorPoint.lat, competitorPoint.lng, 6),
              locationName: cluster.area + ", Lagos",
              location: {
                type: "Point",
                coordinates: [competitorPoint.lng, competitorPoint.lat]
              },
              connectivityFlag: true,
              rsrp: Math.floor(randomBetween(-100, -80)),
              rsrq: Math.floor(randomBetween(-15, -10)),
              deviceId: `device_${Math.floor(Math.random() * 100)}`,
              timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
            });
          }
        }
      }
    });
  });
  
  return points;
}

// Generate random background noise data (unclustered outliers)
function generateBackgroundNoise(count = 100) {
  const points = [];
  
  for (let i = 0; i < count; i++) {
    // Completely random across Lagos
    const latitude = randomBetween(6.40, 6.70);
    const longitude = randomBetween(3.20, 3.50);
    const geohash = ngeohash.encode(latitude, longitude, 6);
    
    points.push({
      signalStrength: Math.floor(randomBetween(-110, -50)),
      provider: providers[Math.floor(Math.random() * providers.length)],
      networkType: networkTypes[Math.floor(Math.random() * networkTypes.length)],
      geohash,
      locationName: lagosAreas[Math.floor(Math.random() * lagosAreas.length)] + ", Lagos",
      location: {
        type: "Point",
        coordinates: [longitude, latitude]
      },
      connectivityFlag: Math.random() > 0.1, // 10% chance of dead zone
      rsrp: Math.random() > 0.3 ? Math.floor(randomBetween(-120, -50)) : null,
      rsrq: Math.random() > 0.5 ? Math.floor(randomBetween(-20, -5)) : null,
      deviceId: `device_${Math.floor(Math.random() * 100)}`,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000))
    });
  }
  
  return points;
}

async function generateClusteredData() {
  try {
    console.log('🗑️  Clearing existing data...');
    await NetworkData.deleteMany({});
    
    console.log('📍 Generating clustered synthetic data...\n');
    
    // Generate all cluster types
    const deadZonePoints = generateDeadZonePoints();
    console.log(`✅ Generated ${deadZonePoints.length} dead zone points in ${CLUSTERS.deadZones.length} clusters`);
    
    const excellentPoints = generateExcellentSignalPoints();
    console.log(`✅ Generated ${excellentPoints.length} excellent signal points in ${CLUSTERS.excellentSignal.length} clusters`);
    
    const poorPoints = generatePoorSignalPoints();
    console.log(`✅ Generated ${poorPoints.length} poor signal points in ${CLUSTERS.poorSignal.length} clusters`);
    
    const providerPoints = generateProviderSpecificPoints();
    console.log(`✅ Generated ${providerPoints.length} provider-specific coverage points`);
    
    const noisePoints = generateBackgroundNoise(150);
    console.log(`✅ Generated ${noisePoints.length} random background noise points\n`);
    
    // Combine all data
    const allData = [
      ...deadZonePoints,
      ...excellentPoints,
      ...poorPoints,
      ...providerPoints,
      ...noisePoints
    ];
    
    console.log(`📊 Total data points: ${allData.length}`);
    console.log('💾 Inserting into MongoDB...');
    
    await NetworkData.insertMany(allData);
    
    console.log('✅ Successfully inserted all data!\n');
    
    // Print summary
    console.log('📈 Data Summary:');
    console.log('================');
    console.log(`Dead Zones: ${deadZonePoints.length} points`);
    console.log(`  - Mushin: ~50 points`);
    console.log(`  - Apapa: ~40 points`);
    console.log(`  - Oshodi: ~35 points`);
    console.log(`  - Ejigbo: ~30 points\n`);
    
    console.log(`Excellent Signal: ${excellentPoints.length} points`);
    console.log(`  - Victoria Island: ~80 points`);
    console.log(`  - Banana Island: ~40 points`);
    console.log(`  - Lekki: ~70 points\n`);
    
    console.log(`Poor Signal: ${poorPoints.length} points`);
    console.log(`  - Ajah: ~60 points`);
    console.log(`  - Maryland: ~50 points`);
    console.log(`  - Festac: ~45 points\n`);
    
    console.log(`Provider-Specific: ${providerPoints.length} points`);
    console.log(`Background Noise: ${noisePoints.length} points\n`);
    
    console.log('🧪 Test the clustering with:');
    console.log('npm run test:clustering');
    console.log('\nOr try these API calls:');
    console.log('curl "http://localhost:3000/api/clustering/deadzones?epsilon=400&minPoints=5"');
    console.log('curl "http://localhost:3000/api/clustering/signal-quality?qualityLevel=excellent&epsilon=500&minPoints=10"');
    console.log('curl "http://localhost:3000/api/clustering/provider/MTN?epsilon=400&minPoints=8"');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateClusteredData();
