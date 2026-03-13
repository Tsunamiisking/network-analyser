import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import PageHeader from '../../components/PageHeader';
import ProviderCard from '../../components/ProviderCard';
import { MOCK_BEST_NETWORK } from '../../constants/mockData';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function Best() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [locationText, setLocationText] = useState('Your Current Location');
  
  // Using mock data - will replace with API call later
  const providersData = MOCK_BEST_NETWORK.data;
  const bestProvider = providersData[0]; // First one is the best (highest signal)
  const otherProviders = providersData.slice(1); // Rest are comparisons
  
  // Simulated refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Replace with actual API call
    // const location = await getCurrentLocation();
    // await fetchBestProvider(location.latitude, location.longitude);
    setTimeout(() => setRefreshing(false), 1500);
  };
  
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.info} />
        <Text style={styles.loadingText}>Finding best network...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title="Best Network" />
      
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
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <MaterialIcons name="location-on" size={40} color={COLORS.info} />
          <Text style={styles.headerTitle}>Best Network Around You</Text>
          <Text style={styles.headerSubtitle}>{locationText}</Text>
          
          {/* Change Location Button */}
          <TouchableOpacity 
            style={styles.changeLocationButton}
            onPress={() => {
              // TODO: Implement location picker or re-fetch current location
              console.log('Change location');
            }}
          >
            <MaterialIcons name="my-location" size={16} color={COLORS.info} />
            <Text style={styles.changeLocationText}>Update Location</Text>
          </TouchableOpacity>
        </View>
        
        {/* Best Provider Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Recommendation</Text>
          <ProviderCard
            provider={bestProvider.provider}
            avgSignalStrength={bestProvider.avgSignalStrength}
            sampleCount={bestProvider.sampleCount}
            coverage={bestProvider.coverage}
            isBest={true}
          />
        </View>
        
        {/* Other Providers Comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Providers</Text>
          <Text style={styles.sectionSubtitle}>
            Comparison of alternative networks in your area
          </Text>
          
          {otherProviders.map((provider, index) => (
            <ProviderCard
              key={provider.provider}
              provider={provider.provider}
              avgSignalStrength={provider.avgSignalStrength}
              sampleCount={provider.sampleCount}
              coverage={provider.coverage}
            />
          ))}
        </View>
        
        {/* Info Note */}
        <View style={styles.infoNote}>
          <MaterialIcons name="info-outline" size={16} color={COLORS.info} />
          <Text style={styles.infoNoteText}>
            Rankings based on signal strength measurements from {providersData.reduce((sum, p) => sum + p.sampleCount, 0).toLocaleString()} samples within 2km of your location
          </Text>
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
  
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
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
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});