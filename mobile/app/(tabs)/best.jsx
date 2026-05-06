import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import PageHeader from '../../components/PageHeader';
import ProviderCard from '../../components/ProviderCard';
import { getBestNetwork } from '../../services/api';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function Best() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [providersData, setProvidersData] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationText, setLocationText] = useState('Fetching location...');
  const [error, setError] = useState(null);
  const [searchRadius, setSearchRadius] = useState(2000); // Start with 2km
  
  const bestProvider = providersData[0]; // First one is the best (highest signal)
  const otherProviders = providersData.slice(1); // Rest are comparisons

  // Normalize provider name for consistent display
  const normalizeProviderName = (name) => {
    if (!name) return '';
    // Handle special case for 9mobile
    if (name.toLowerCase() === '9mobile') return '9mobile';
    // Title case for others
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // Get user's location
  const getCurrentLocation = async () => {
    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Location permission denied');
        setLocationText('Location access denied');
        return null;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Get address for display
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        if (addresses[0]) {
          const addr = addresses[0];
          setLocationText(
            addr.city 
              ? `${addr.city}, ${addr.region || addr.country}` 
              : addr.region || 'Your Current Location'
          );
        }
      } catch (err) {
        setLocationText('Your Current Location');
      }

      return location.coords;
    } catch (err) {
      console.error('Location error:', err);
      setError('Failed to get location');
      setLocationText('Location unavailable');
      return null;
    }
  };

  // Fetch best network data
  const fetchBestNetwork = async (coords, radius = searchRadius) => {
    if (!coords) return;

    try {
      setError(null);
      const response = await getBestNetwork(coords.latitude, coords.longitude, radius);
      
      // Handle 404 (no data) separately from errors
      if (response.statusCode === 404 || !response.success) {
        // If first attempt with 2km failed, try expanding to 5km automatically
        if (radius === 2000) {
          console.log('📡 No data found within 2km, expanding search to 5km...');
          setSearchRadius(5000);
          return fetchBestNetwork(coords, 5000);
        }
        // This is not an error - just no data available
        setProvidersData([]);
        return;
      }
      
      if (response.success && response.allProviders && response.allProviders.length > 0) {
        setProvidersData(response.allProviders);
        setSearchRadius(radius); // Remember successful radius
      } else {
        setProvidersData([]);
      }
    } catch (err) {
      // Real errors only (network issues, timeouts, server errors)
      console.error('API error:', err);
      setError(err.message || 'Failed to fetch network data');
      setProvidersData([]);
    }
  };

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      const coords = await getCurrentLocation();
      if (coords) {
        await fetchBestNetwork(coords);
      }
      setIsLoading(false);
    };

    initializeData();
  }, []);
  
  // Refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    const coords = currentLocation || await getCurrentLocation();
    if (coords) {
      await fetchBestNetwork(coords);
    }
    setRefreshing(false);
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <PageHeader title="Best Network" />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.info} />
          <Text style={styles.loadingText}>Finding best network...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title="Best Network" />
      
      {/* Location Bar */}
      <View style={styles.locationBar}>
        <View style={styles.locationInfo}>
          <MaterialIcons name="location-on" size={20} color={COLORS.info} />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationText}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.locationButton}
          onPress={async () => {
            setIsLoading(true);
            setSearchRadius(2000);
            const coords = await getCurrentLocation();
            if (coords) {
              await fetchBestNetwork(coords, 2000);
            }
            setIsLoading(false);
          }}
        >
          <MaterialIcons name="my-location" size={18} color={COLORS.info} />
        </TouchableOpacity>
      </View>

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
        {/* Error State */}
        {error && (
          <View style={styles.messageCard}>
            <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
            <Text style={styles.messageTitle}>Connection Error</Text>
            <Text style={styles.messageText}>{error}</Text>
            <TouchableOpacity style={styles.actionButton} onPress={onRefresh}>
              <MaterialIcons name="refresh" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!error && providersData.length === 0 && (
          <View style={styles.messageCard}>
            <MaterialIcons name="signal-wifi-off" size={48} color={COLORS.textMuted} />
            <Text style={styles.messageTitle}>No Data Available</Text>
            <Text style={styles.messageText}>
              No signal measurements found within {searchRadius >= 1000 ? `${searchRadius/1000}km` : `${searchRadius}m`}
            </Text>
            <TouchableOpacity style={styles.actionButton} onPress={onRefresh}>
              <MaterialIcons name="refresh" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Refresh</Text>
            </TouchableOpacity>
            <Text style={styles.hintText}>
              💡 Help improve coverage by submitting measurements
            </Text>
          </View>
        )}
        
        {/* Providers List */}
        {providersData.length > 0 && (
          <>
            {/* Best Provider */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RECOMMENDED</Text>
              <ProviderCard
                provider={normalizeProviderName(bestProvider.provider)}
                avgSignalStrength={bestProvider.avgSignalStrength}
                sampleCount={bestProvider.count}
                isBest={true}
              />
            </View>
            
            {/* Other Providers */}
            {otherProviders.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ALTERNATIVES</Text>
                {otherProviders.map((provider) => (
                  <ProviderCard
                    key={provider.provider}
                    provider={normalizeProviderName(provider.provider)}
                    avgSignalStrength={provider.avgSignalStrength}
                    sampleCount={provider.count}
                  />
                ))}
              </View>
            )}
            
            {/* Info Footer */}
            <View style={styles.infoFooter}>
              <MaterialIcons name="info-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.infoFooterText}>
                Based on {providersData.reduce((sum, p) => sum + p.count, 0).toLocaleString()} measurements · {searchRadius >= 1000 ? `${searchRadius/1000}km` : `${searchRadius}m`} radius
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  
  locationText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    flex: 1,
  },
  
  locationButton: {
    padding: SPACING.sm,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    padding: SPACING.md,
  },
  
  messageCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.lg,
  },
  
  messageTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
  },
  
  messageText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.info,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  
  actionButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: '#fff',
  },
  
  hintText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  
  section: {
    marginBottom: SPACING.lg,
  },
  
  sectionLabel: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  
  infoFooterText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  
  headerInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  
  headerTitle: {
    fontFamily: FONTS.header,
    fontSize: FONT_SIZES.header,
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
  },
  
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.info,
  },
  
  changeLocationText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.info,
  },
  
  section: {
    marginBottom: SPACING.lg,
  },
  
  sectionTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.info,
  },
  
  infoNoteText: {
    flex: 1,
    fontFamily: FONTS.regular,
  
  errorCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  
  errorTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  
  retryButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: '#fff',
  },
  
  emptyCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.info + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  
  emptyTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  
  emptyActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.info,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  
  primaryActionText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: '#fff',
  },
  
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.info,
  },
  
  secondaryActionText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: COLORS.info,
  },
  
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.warning + '10',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  
  emptyHintText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});