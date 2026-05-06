/**
 * Test script for DBSCAN clustering service
 * Run with: node scripts/testClustering.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const NetworkData = require('../src/models/NetworkData');
const clusteringService = require('../src/services/clusteringService');

async function testClustering() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    const dbName = process.env.DB_NAME || 'network-analyser-db';
    await mongoose.connect(process.env.MONGODB_URI, { dbName });
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Dead Zone Clustering
    console.log('📍 Test 1: Dead Zone Clustering');
    console.log('================================');
    const deadZones = await NetworkData.find({ connectivityFlag: false }).limit(100);
    console.log(`Found ${deadZones.length} dead zone measurements`);
    
    if (deadZones.length > 0) {
      // Use larger epsilon for dead zones (800m to capture spread-out clusters)
      const deadZoneResult = clusteringService.clusterDeadZones(deadZones, 800, 3);
      console.log(`✅ Clusters found: ${deadZoneResult.stats.totalClusters}`);
      console.log(`   Noise points: ${deadZoneResult.stats.totalNoise}`);
      console.log(`   Clustering rate: ${deadZoneResult.stats.clusteringRate}\n`);

      if (deadZoneResult.clusters.length > 0) {
        const largestCluster = deadZoneResult.clusters[0];
        console.log(`   Largest cluster: ${largestCluster.pointCount} points`);
        console.log(`   Centroid: [${largestCluster.centroid.lat.toFixed(4)}, ${largestCluster.centroid.lng.toFixed(4)}]`);
        console.log(`   Providers: ${largestCluster.providers.join(', ')}\n`);
      }
    } else {
      console.log('⚠️  No dead zones found in database\n');
    }

    // Test 2: Signal Quality Clustering
    console.log('📊 Test 2: Signal Quality Clustering (Poor)');
    console.log('=========================================');
    const allData = await NetworkData.find({}).limit(500);
    console.log(`Found ${allData.length} total measurements`);
    
    if (allData.length > 0) {
      // Use larger epsilon (1000m) and lower minPoints (5)
      const qualityResult = clusteringService.clusterBySignalQuality(allData, 'poor', 1000, 5);
      console.log(`✅ Poor signal clusters: ${qualityResult.stats.totalClusters}`);
      console.log(`   Noise points: ${qualityResult.stats.totalNoise}`);
      console.log(`   Clustering rate: ${qualityResult.stats.clusteringRate}\n`);
    }

    // Test 3: Provider-Specific Clustering
    console.log('🏢 Test 3: Provider-Specific Clustering (MTN)');
    console.log('===========================================');
    const mtnData = await NetworkData.find({ provider: 'MTN' }).limit(500);
    console.log(`Found ${mtnData.length} MTN measurements`);
    
    if (mtnData.length > 0) {
      // Use larger epsilon (800m) and lower minPoints (5)
      const providerResult = clusteringService.clusterByProvider(mtnData, 'MTN', 800, 5);
      console.log(`✅ MTN clusters: ${providerResult.stats.totalClusters}`);
      console.log(`   Noise points: ${providerResult.stats.totalNoise}`);
      console.log(`   Clustering rate: ${providerResult.stats.clusteringRate}\n`);
    }

    // Test 4: Anomaly Detection
    console.log('🔍 Test 4: Anomaly Detection');
    console.log('============================');
    if (allData.length > 0) {
      // Use larger epsilon (1000m) to identify true outliers
      const anomalyResult = clusteringService.findAnomalies(allData, 1000, 5);
      console.log(`✅ Anomalies found: ${anomalyResult.count}`);
      console.log(`   Percentage: ${anomalyResult.percentage}`);
      console.log(`   Total points analyzed: ${anomalyResult.stats.totalPoints}\n`);
    }

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testClustering();
