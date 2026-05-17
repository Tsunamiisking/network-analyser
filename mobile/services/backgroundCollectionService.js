/**
 * backgroundCollectionService.js
 * 
 * Manages background network data collection for both iOS and Android.
 * 
 * Features:
 * - 12-minute periodic collection intervals
 * - Battery-aware (skips if battery < 15%)
 * - Offline queue support
 * - Location-based triggers
 * - User toggle control
 * 
 * Compatible with:
 * - Android: Background fetch + location updates
 * - iOS: Background location + significant location change
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { assembleTelemetryPacket } from './sensingService';
import { submitNetworkData } from './api';
import { recordSuccess, recordFailure } from './submissionTracker';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const BACKGROUND_FETCH_TASK = 'background-network-collection';
const BACKGROUND_LOCATION_TASK = 'background-location-collection';
const COLLECTION_INTERVAL = 12 * 60; // 12 minutes in seconds
const MIN_BATTERY_LEVEL = 0.15; // Skip if battery below 15%
const SETTINGS_KEY = 'backgroundCollectionSettings';

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  lastCollectionTime: null,
  totalCollections: 0,
  failedCollections: 0,
};

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────

export const getSettings = async () => {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const updateSettings = async (updates) => {
  try {
    const current = await getSettings();
    const updated = { ...current, ...updates };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to update settings:', error);
    return current;
  }
};

// ─── BATTERY CHECK ───────────────────────────────────────────────────────────

const hasSufficientBattery = async () => {
  try {
    const batteryLevel = await Battery.getBatteryLevelAsync();
    const batteryState = await Battery.getBatteryStateAsync();
    
    // Allow if charging or battery level is sufficient
    if (batteryState === Battery.BatteryState.CHARGING || 
        batteryState === Battery.BatteryState.FULL) {
      return true;
    }
    
    return batteryLevel >= MIN_BATTERY_LEVEL;
  } catch (error) {
    console.warn('Battery check failed, proceeding anyway:', error);
    return true; // Proceed if battery API fails
  }
};

// ─── COLLECTION LOGIC ────────────────────────────────────────────────────────

const performCollection = async () => {
  const settings = await getSettings();
  
  // Check if background collection is enabled
  if (!settings.enabled) {
    console.log('📍 Background collection disabled by user');
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  // Check battery level
  const hasEnoughBattery = await hasSufficientBattery();
  if (!hasEnoughBattery) {
    console.log('🔋 Battery too low, skipping collection');
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  try {
    console.log('📍 Starting background network collection...');
    
    // Assemble telemetry packet (includes location, signal, carrier, etc.)
    const telemetryData = await assembleTelemetryPacket();
    
    if (!telemetryData) {
      console.log('⚠️  Failed to assemble telemetry (likely no location)');
      await updateSettings({ 
        failedCollections: settings.failedCollections + 1 
      });
      await recordFailure();
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    // Submit to backend
    await submitNetworkData(telemetryData);
    
    console.log(`✅ Background collection successful! Signal: ${telemetryData.signalStrength}dBm, Provider: ${telemetryData.provider}`);
    
    // Update background collection stats
    await updateSettings({
      lastCollectionTime: new Date().toISOString(),
      totalCollections: settings.totalCollections + 1,
    });
    
    // Track successful background submission in unified tracker
    await recordSuccess('background');
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
    
  } catch (error) {
    console.error('❌ Background collection failed:', error);
    await updateSettings({ 
      failedCollections: settings.failedCollections + 1 
    });
    await recordFailure();
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
};

// ─── TASK DEFINITIONS ────────────────────────────────────────────────────────

// Background fetch task (periodic, every 12 minutes)
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('🔄 Background fetch task triggered');
  return await performCollection();
});

// Background location task (iOS significant location change)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    console.log(`📍 Location changed (${locations.length} updates), triggering collection`);
    await performCollection();
  }
});

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Start background collection
 * Requests permissions and registers background tasks
 */
export const startBackgroundCollection = async () => {
  try {
    console.log('🚀 Starting background collection...');
    
    // Request location permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      throw new Error('Foreground location permission not granted');
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      throw new Error('Background location permission not granted');
    }

    // Register background fetch task (periodic 12-minute intervals)
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: COLLECTION_INTERVAL, // 12 minutes
      stopOnTerminate: false, // Continue after app termination
      startOnBoot: true, // Start on device boot
    });

    // Register background location task (iOS significant location changes)
    if (Platform.OS === 'ios') {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 500, // Trigger every 500 meters
        deferredUpdatesInterval: COLLECTION_INTERVAL * 1000, // Match fetch interval
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Network Analyser',
          notificationBody: 'Collecting network quality data',
        },
      });
    }

    // Enable in settings
    await updateSettings({ enabled: true });
    
    console.log('✅ Background collection started successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to start background collection:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Stop background collection
 * Unregisters all background tasks
 */
export const stopBackgroundCollection = async () => {
  try {
    console.log('🛑 Stopping background collection...');
    
    // Unregister background fetch
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    
    // Stop location updates (iOS)
    if (Platform.OS === 'ios') {
      const hasTask = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (hasTask) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    }
    
    // Disable in settings
    await updateSettings({ enabled: false });
    
    console.log('✅ Background collection stopped');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to stop background collection:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if background collection is currently registered
 */
export const isBackgroundCollectionRegistered = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    return isRegistered;
  } catch (error) {
    console.error('Failed to check registration status:', error);
    return false;
  }
};

/**
 * Get collection statistics
 */
export const getCollectionStats = async () => {
  const settings = await getSettings();
  const isRegistered = await isBackgroundCollectionRegistered();
  const batteryLevel = await Battery.getBatteryLevelAsync();
  
  return {
    enabled: settings.enabled,
    isRegistered,
    lastCollectionTime: settings.lastCollectionTime,
    totalCollections: settings.totalCollections,
    failedCollections: settings.failedCollections,
    successRate: settings.totalCollections > 0 
      ? ((settings.totalCollections - settings.failedCollections) / settings.totalCollections * 100).toFixed(1)
      : 0,
    batteryLevel: (batteryLevel * 100).toFixed(0),
  };
};

/**
 * Reset statistics
 */
export const resetStats = async () => {
  await updateSettings({
    totalCollections: 0,
    failedCollections: 0,
  });
};
