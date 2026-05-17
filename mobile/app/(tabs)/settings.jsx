import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import PageHeader from '../../components/PageHeader';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  SHADOWS,
} from '../../constants/theme';
import {
  startBackgroundCollection,
  stopBackgroundCollection,
  getCollectionStats,
  resetStats as resetBackgroundStats,
  isBackgroundCollectionRegistered,
} from '../../services/backgroundCollectionService';
import { 
  getSubmissionStats, 
  resetStats as resetSubmissionStats,
  getSuccessRate,
} from '../../services/submissionTracker';
import { getDeviceId } from '../../utils/helpers';

export default function Settings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [stats, setStats] = useState(null);
  const [submissionStats, setSubmissionStats] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSettings();
    loadDeviceId();
  }, []);

  const loadDeviceId = async () => {
    const id = await getDeviceId();
    setDeviceId(id);
  };

  const loadSettings = async () => {
    try {
      const collectionStats = await getCollectionStats();
      const submissions = await getSubmissionStats();
      const registered = await isBackgroundCollectionRegistered();
      
      setStats(collectionStats);
      setSubmissionStats(submissions);
      setIsEnabled(collectionStats.enabled);
      setIsRegistered(registered);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSettings();
  };

  const handleToggleBackgroundCollection = async (value) => {
    try {
      if (value) {
        // Enable background collection
        const result = await startBackgroundCollection();
        
        if (result.success) {
          Alert.alert(
            'Background Collection Enabled',
            'The app will now collect network data every 10 minutes in the background. You can disable this anytime.',
            [{ text: 'OK' }]
          );
          setIsEnabled(true);
          setIsRegistered(true);
        } else {
          Alert.alert(
            'Permission Required',
            result.error || 'Please grant "Always Allow" location permission in Settings to enable background collection.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => {
                  // User needs to manually enable in system settings
                  Alert.alert('Instructions', 'Go to Settings > Network Analyser > Location > Always Allow');
                }
              }
            ]
          );
          setIsEnabled(false);
        }
      } else {
        // Disable background collection
        const result = await stopBackgroundCollection();
        
        if (result.success) {
          Alert.alert(
            'Background Collection Disabled',
            'Background data collection has been stopped.',
            [{ text: 'OK' }]
          );
          setIsEnabled(false);
          setIsRegistered(false);
        }
      }
      
      // Reload stats
      await loadSettings();
      
    } catch (error) {
      console.error('Toggle failed:', error);
      Alert.alert('Error', 'Failed to toggle background collection. Please try again.');
    }
  };

  const handleResetStats = () => {
    Alert.alert(
      'Reset Statistics',
      'Are you sure you want to reset all statistics? This will clear both manual and background submission counts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetBackgroundStats();
            await resetSubmissionStats();
            await loadSettings();
            Alert.alert('Success', 'All statistics have been reset.');
          },
        },
      ]
    );
  };

  const formatLastCollection = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="Settings" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Settings" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.info}
            colors={[COLORS.info]}
          />
        }
      >
        {/* Background Collection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Background Collection</Text>
          
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialIcons name="sensors" size={24} color={COLORS.info} />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Auto-collect Data</Text>
                  <Text style={styles.settingDescription}>
                    Collect network data every 10 minutes
                  </Text>
                </View>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={handleToggleBackgroundCollection}
                trackColor={{ false: COLORS.border, true: COLORS.success }}
                thumbColor={COLORS.textPrimary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <MaterialIcons 
                name={isRegistered ? 'check-circle' : 'cancel'} 
                size={20} 
                color={isRegistered ? COLORS.success : COLORS.textMuted} 
              />
              <Text style={styles.infoText}>
                Status: {isRegistered ? 'Active' : 'Inactive'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="schedule" size={20} color={COLORS.info} />
              <Text style={styles.infoText}>
                Last Collection: {formatLastCollection(stats?.lastCollectionTime)}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="battery-std" size={20} color={COLORS.warning} />
              <Text style={styles.infoText}>
                Battery Level: {stats?.batteryLevel}%
              </Text>
            </View>
          </View>
        </View>

        {/* Statistics Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Overall Statistics</Text>
            <TouchableOpacity onPress={handleResetStats}>
              <Text style={styles.resetButton}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialIcons name="cloud-upload" size={32} color={COLORS.success} />
              <Text style={styles.statValue}>{submissionStats?.totalSubmissions || 0}</Text>
              <Text style={styles.statLabel}>Total Submissions</Text>
            </View>

            <View style={styles.statCard}>
              <MaterialIcons name="touch-app" size={32} color={COLORS.info} />
              <Text style={styles.statValue}>{submissionStats?.manualSubmissions || 0}</Text>
              <Text style={styles.statLabel}>Manual</Text>
            </View>

            <View style={styles.statCard}>
              <MaterialIcons name="schedule" size={32} color={COLORS.warning} />
              <Text style={styles.statValue}>{submissionStats?.backgroundSubmissions || 0}</Text>
              <Text style={styles.statLabel}>Background</Text>
            </View>
          </View>

          <View style={[styles.statsGrid, { marginTop: SPACING.sm }]}>
            <View style={styles.statCard}>
              <MaterialIcons name="error-outline" size={32} color={COLORS.error} />
              <Text style={styles.statValue}>{submissionStats?.failedSubmissions || 0}</Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>

            <View style={styles.statCard}>
              <MaterialIcons name="trending-up" size={32} color={COLORS.success} />
              <Text style={styles.statValue}>{getSuccessRate(submissionStats || {})}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>

            <View style={styles.statCard}>
              <MaterialIcons name="access-time" size={32} color={COLORS.textSecondary} />
              <Text style={[styles.statValue, { fontSize: FONT_SIZES.body }]} numberOfLines={1} adjustsFontSizeToFit>
                {submissionStats?.lastSubmissionTime 
                  ? formatLastCollection(submissionStats.lastSubmissionTime) 
                  : 'Never'}
              </Text>
              <Text style={styles.statLabel}>Last Submission</Text>
            </View>
          </View>
        </View>

        {/* Device Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Information</Text>
          
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <MaterialIcons name="phone-android" size={20} color={COLORS.info} />
              <Text style={styles.infoText}>Device ID</Text>
            </View>
            <Text style={styles.deviceIdText}>{deviceId || 'Loading...'}</Text>
          </View>
        </View>

        {/* Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          
          <View style={styles.card}>
            <View style={styles.infoBox}>
              <MaterialIcons name="info-outline" size={20} color={COLORS.info} />
              <Text style={styles.infoBoxText}>
                Background collection helps improve network coverage maps by automatically 
                collecting signal data. Data is collected every 10 minutes when your battery 
                is above 15%.
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoBox}>
              <MaterialIcons name="security" size={20} color={COLORS.success} />
              <Text style={styles.infoBoxText}>
                All data is anonymous. We only collect network quality metrics and approximate 
                location. No personal information is stored.
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoBox}>
              <MaterialIcons name="battery-charging-full" size={20} color={COLORS.warning} />
              <Text style={styles.infoBoxText}>
                Collection automatically pauses when battery is below 15% to preserve battery life.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  section: {
    marginBottom: SPACING.lg,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },

  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },

  resetButton: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.danger,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.md,
  },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },

  settingText: {
    flex: 1,
  },

  settingLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },

  settingDescription: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginVertical: SPACING.xs,
  },

  infoText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
  },

  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.md,
  },

  statValue: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  statLabel: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xxs,
  },

  deviceIdText: {
    fontFamily: FONTS.mono || FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    marginLeft: 26,
  },

  infoBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },

  infoBoxText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
