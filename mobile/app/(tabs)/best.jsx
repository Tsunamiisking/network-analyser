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
          <View style={styles.errorCard}>
            <View style={styles.errorIconContainer}>
              <MaterialIcons name="cloud-off" size={48} color={COLORS.error} />
            </View>
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={onRefresh}>
              <MaterialIcons name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!error && providersData.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="explore-off" size={56} color={COLORS.info} />
            </View>
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              We searched within {searchRadius >= 1000 ? `${searchRadius/1000}km` : `${searchRadius}m`} but couldn't find signal measurements in your area.
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity 
                style={styles.primaryButton}
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
                <MaterialIcons name="my-location" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Update Location</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={onRefresh}
              >
                <MaterialIcons name="refresh" size={18} color={COLORS.info} />
                <Text style={styles.secondaryButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.hintCard}>
              <MaterialIcons name="lightbulb-outline" size={16} color={COLORS.warning} />
              <Text style={styles.hintText}>
                Help improve coverage data by submitting signal measurements
              </Text>
            </View>
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
  
  // Error State
  errorCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
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
  },
  
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Empty State
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.info + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.info + '30',
  },
  
  emptyTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
  },
  
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  emptyActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    width: '100%',
  },
  
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.info,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  
  primaryButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: '#fff',
  },
  
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.info,
  },
  
  secondaryButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: COLORS.info,
  },
  
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.warning + '10',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
    marginTop: SPACING.sm,
  },
  
  hintText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  
  section: {
    marginBottom: SPACING.xl,
  },
  
  sectionLabel: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.small,
    color: COLORS.info,
    marginBottom: SPACING.md,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  infoFooterText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});