/**
 * appInitService.js
 * 
 * Handles app initialization tasks
 * - Registers background tasks on app start
 * - Initializes services
 */

import { isBackgroundCollectionRegistered, startBackgroundCollection, getSettings } from './backgroundCollectionService';

/**
 * Initialize app services on startup
 */
export const initializeApp = async () => {
  try {
    console.log('🚀 Initializing app services...');
    
    // Check if background collection should be enabled
    const settings = await getSettings();
    const isRegistered = await isBackgroundCollectionRegistered();
    
    // If user had it enabled but it's not registered (e.g., after app restart),
    // re-register the background task
    if (settings.enabled && !isRegistered) {
      console.log('📍 Re-registering background collection...');
      await startBackgroundCollection();
    }
    
    console.log('✅ App initialization complete');
    
  } catch (error) {
    console.error('❌ App initialization failed:', error);
  }
};
