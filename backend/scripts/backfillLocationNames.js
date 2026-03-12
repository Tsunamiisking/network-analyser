const mongoose = require("mongoose");
const axios = require("axios");
const NetworkData = require("../src/models/NetworkData");
require("dotenv").config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'network-analyser-db';

// Rate limiting configuration for Nominatim (1 request per second per their policy)
const DELAY_MS = 1100; // 1.1 seconds between requests
const BATCH_SIZE = 50; // Process 50 records at a time

/**
 * Reverse geocode using OpenStreetMap Nominatim (free, no API key required)
 * Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
 */
async function reverseGeocode(latitude, longitude) {
  try {
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/reverse',
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          zoom: 14, // City/suburb level
        },
        headers: {
          'User-Agent': 'NetworkAnalyzer/1.0 (Testing)'
        },
        timeout: 5000
      }
    );
    
    if (response.data && response.data.address) {
      const address = response.data.address;
      
      // Try to extract suburb/neighborhood and city
      const suburb = address.suburb || address.neighbourhood || address.quarter;
      const city = address.city || address.town || address.county;
      const state = address.state;
      
      // Format location name
      if (suburb && city) {
        return `${suburb}, ${city}`;
      } else if (city && state) {
        return `${city}, ${state}`;
      } else if (city) {
        return city;
      } else {
        // Fallback to display_name (might be long)
        return response.data.display_name.split(',').slice(0, 2).join(',').trim();
      }
    }
    
    return null;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`Timeout for coordinates: ${latitude}, ${longitude}`);
    } else if (error.response) {
      console.error(`Geocoding error (${error.response.status}): ${latitude}, ${longitude}`);
    } else {
      console.error(`Network error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main migration function
 */
async function backfillLocationNames() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, { dbName });
    console.log('Connected successfully!\n');
    
    // Count records without locationName
    const missingCount = await NetworkData.countDocuments({ 
      locationName: { $in: [null, ''] }
    });
    
    console.log(`Found ${missingCount} records without locationName`);
    
    if (missingCount === 0) {
      console.log('No records to update!');
      process.exit(0);
    }
    
    console.log(`Processing in batches of ${BATCH_SIZE}...`);
    console.log(`Rate limited to 1 request per ${DELAY_MS}ms (Nominatim policy)\n`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // Process in batches
    while (processedCount < missingCount) {
      // Fetch batch of records
      const records = await NetworkData.find({ 
        locationName: { $in: [null, ''] }
      })
      .limit(BATCH_SIZE)
      .select('_id location');
      
      if (records.length === 0) break;
      
      console.log(`\nProcessing batch: ${processedCount + 1} - ${processedCount + records.length}`);
      
      // Process each record in the batch
      for (const record of records) {
        const [longitude, latitude] = record.location.coordinates;
        
        // Reverse geocode
        const locationName = await reverseGeocode(latitude, longitude);
        
        if (locationName) {
          // Update record
          await NetworkData.updateOne(
            { _id: record._id },
            { $set: { locationName } }
          );
          successCount++;
          console.log(`✓ ${successCount}/${missingCount}: ${locationName}`);
        } else {
          errorCount++;
          console.log(`✗ ${processedCount + 1}: Failed to geocode ${latitude}, ${longitude}`);
        }
        
        processedCount++;
        
        // Rate limiting delay (except for last record)
        if (processedCount < missingCount) {
          await sleep(DELAY_MS);
        }
      }
      
      // Show progress
      const percentage = ((processedCount / missingCount) * 100).toFixed(1);
      console.log(`\nProgress: ${processedCount}/${missingCount} (${percentage}%)`);
      console.log(`Success: ${successCount} | Errors: ${errorCount}`);
    }
    
    console.log('\n========================================');
    console.log('Migration completed!');
    console.log(`Total processed: ${processedCount}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
console.log('========================================');
console.log('Location Name Backfill Migration');
console.log('Using OpenStreetMap Nominatim');
console.log('========================================\n');

backfillLocationNames();
