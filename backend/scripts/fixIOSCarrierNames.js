/**
 * Database Migration Script: Fix iOS Carrier Names
 * 
 * Updates all network data records where provider is "iOS Carrier" or "--"
 * and changes them to "MTN" (or any specified provider).
 * 
 * Usage:
 *   node scripts/fixIOSCarrierNames.js [provider]
 * 
 * Examples:
 *   node scripts/fixIOSCarrierNames.js MTN
 *   node scripts/fixIOSCarrierNames.js Airtel
 */

const mongoose = require('mongoose');
const NetworkData = require('../src/models/NetworkData');
require('dotenv').config();

// Get target provider from command line args, default to MTN
const targetProvider = process.argv[2] || 'MTN';

// Validate provider name
const VALID_PROVIDERS = ['MTN', 'Airtel', 'Glo', '9mobile'];
if (!VALID_PROVIDERS.includes(targetProvider)) {
  console.error(`❌ Invalid provider: ${targetProvider}`);
  console.error(`   Valid options: ${VALID_PROVIDERS.join(', ')}`);
  process.exit(1);
}

async function fixCarrierNames() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'network-analyser-db',
    });
    console.log('✅ Connected to MongoDB\n');

    // First, let's see what providers actually exist in the database
    const allProviders = await NetworkData.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('🔍 All Providers in Database:');
    allProviders.forEach(stat => {
      console.log(`   - "${stat._id}": ${stat.count} records`);
    });
    console.log();

    // Count records before update
    const iosCarrierCount = await NetworkData.countDocuments({ 
      provider: 'iOS Carrier' 
    });
    const dashCount = await NetworkData.countDocuments({ 
      provider: '--' 
    });
    const unknownCount = await NetworkData.countDocuments({ 
      provider: 'Unknown' 
    });

    console.log('📊 Current Database State:');
    console.log(`   - "iOS Carrier": ${iosCarrierCount} records`);
    console.log(`   - "--": ${dashCount} records`);
    console.log(`   - "Unknown": ${unknownCount} records`);
    console.log(`   - Total to update: ${iosCarrierCount + dashCount + unknownCount} records\n`);

    if (iosCarrierCount + dashCount + unknownCount === 0) {
      console.log('✨ No records to update. Database is clean!');
      await mongoose.connection.close();
      return;
    }

    // Confirm with user (in production, you might want to add readline prompt)
    console.log(`⚠️  About to update all records to provider: "${targetProvider}"`);
    console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Update "iOS Carrier" records
    if (iosCarrierCount > 0) {
      const result1 = await NetworkData.updateMany(
        { provider: 'iOS Carrier' },
        { $set: { provider: targetProvider } }
      );
      console.log(`✅ Updated ${result1.modifiedCount} "iOS Carrier" records to "${targetProvider}"`);
    }

    // Update "--" records
    if (dashCount > 0) {
      const result2 = await NetworkData.updateMany(
        { provider: '--' },
        { $set: { provider: targetProvider } }
      );
      console.log(`✅ Updated ${result2.modifiedCount} "--" records to "${targetProvider}"`);
    }

    // Update "Unknown" records (optional - user can comment this out)
    if (unknownCount > 0) {
      const result3 = await NetworkData.updateMany(
        { provider: 'Unknown' },
        { $set: { provider: targetProvider } }
      );
      console.log(`✅ Updated ${result3.modifiedCount} "Unknown" records to "${targetProvider}"`);
    }

    // Verify the updates
    console.log('\n📊 Final Database State:');
    const finalProviderCount = await NetworkData.countDocuments({ 
      provider: targetProvider 
    });
    console.log(`   - "${targetProvider}": ${finalProviderCount} records`);

    // Show provider distribution
    const providerStats = await NetworkData.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📈 Provider Distribution:');
    providerStats.forEach(stat => {
      console.log(`   - ${stat._id}: ${stat.count} records`);
    });

    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the migration
fixCarrierNames();
