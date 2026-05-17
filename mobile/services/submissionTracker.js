/**
 * submissionTracker.js
 * 
 * Tracks ALL network data submissions (manual + background)
 * Provides unified statistics across the app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STATS_KEY = 'networkSubmissionStats';

const DEFAULT_STATS = {
  totalSubmissions: 0,
  failedSubmissions: 0,
  lastSubmissionTime: null,
  backgroundSubmissions: 0,
  manualSubmissions: 0,
};

/**
 * Get submission statistics
 */
export const getSubmissionStats = async () => {
  try {
    const stored = await AsyncStorage.getItem(STATS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_STATS;
  } catch (error) {
    console.error('Failed to get submission stats:', error);
    return DEFAULT_STATS;
  }
};

/**
 * Update submission statistics
 */
const updateStats = async (updates) => {
  try {
    const current = await getSubmissionStats();
    const updated = { ...current, ...updates };
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to update submission stats:', error);
    return current;
  }
};

/**
 * Record a successful submission
 * @param {string} type - 'manual' or 'background'
 */
export const recordSuccess = async (type = 'manual') => {
  const stats = await getSubmissionStats();
  
  const updates = {
    totalSubmissions: stats.totalSubmissions + 1,
    lastSubmissionTime: new Date().toISOString(),
  };
  
  if (type === 'background') {
    updates.backgroundSubmissions = stats.backgroundSubmissions + 1;
  } else {
    updates.manualSubmissions = stats.manualSubmissions + 1;
  }
  
  return await updateStats(updates);
};

/**
 * Record a failed submission
 */
export const recordFailure = async () => {
  const stats = await getSubmissionStats();
  return await updateStats({
    failedSubmissions: stats.failedSubmissions + 1,
  });
};

/**
 * Reset all statistics
 */
export const resetStats = async () => {
  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(DEFAULT_STATS));
};

/**
 * Calculate success rate
 */
export const getSuccessRate = (stats) => {
  const total = stats.totalSubmissions + stats.failedSubmissions;
  if (total === 0) return 0;
  return ((stats.totalSubmissions / total) * 100).toFixed(1);
};
