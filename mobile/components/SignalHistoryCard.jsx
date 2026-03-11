import { View, Text, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS, getSignalColor, getSignalLabel } from '../constants/theme';
import { reverseGeocodeWithCache, formatCoordinates } from '../utils/geocoding';

/**
 * Signal History Card Component
 * Displays individual signal measurement record
 */
export default function SignalHistoryCard({ item }) {
  const signalColor = getSignalColor(item.signalStrength);
  const signalLabel = getSignalLabel(item.signalStrength);
  const [locationText, setLocationText] = useState(item.locationName || 'Loading location...');
  
  // Format timestamp
  const date = new Date(item.timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  // Get location name
  useEffect(() => {
    const getLocation = async () => {
      // Use cached locationName if available
      if (item.locationName) {
        setLocationText(item.locationName);
        return;
      }
      
      // Otherwise, reverse geocode
      const [longitude, latitude] = item.location.coordinates;
      try {
        const location = await reverseGeocodeWithCache(latitude, longitude);
        setLocationText(location);
      } catch (error) {
        // Fallback to coordinates
        setLocationText(formatCoordinates(latitude, longitude));
      }
    };
    
    getLocation();
  }, [item]);

  return (
    <View style={styles.card}>
      {/* Signal Strength Indicator */}
      <View style={[styles.signalIndicator, { backgroundColor: signalColor }]} />
      
      <View style={styles.content}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.providerBadge}>
            <Text style={styles.provider}>{item.provider}</Text>
            <View style={[styles.networkTypeBadge, { backgroundColor: signalColor + '20' }]}>
              <Text style={[styles.networkType, { color: signalColor }]}>
                {item.networkType}
              </Text>
            </View>
          </View>
          
          {/* Connectivity Flag */}
          {!item.connectivityFlag && (
            <View style={styles.noConnectivityBadge}>
              <MaterialIcons name="signal-wifi-off" size={14} color={COLORS.error} />
              <Text style={styles.noConnectivityText}>No Data</Text>
            </View>
          )}
        </View>
        
        {/* Signal Strength */}
        <View style={styles.signalRow}>
          <MaterialIcons 
            name="signal-cellular-alt" 
            size={20} 
            color={signalColor} 
          />
          <Text style={[styles.signalStrength, { color: signalColor }]}>
            {item.signalStrength} dBm
          </Text>
          <Text style={styles.signalLabel}>• {signalLabel}</Text>
        </View>
        
        {/* Location */}
        <View style={styles.infoRow}>
          <MaterialIcons name="location-on" size={14} color={COLORS.textMuted} />
          <Text style={styles.infoText}>{locationText}</Text>
        </View>
        
        {/* Timestamp */}
        <View style={styles.infoRow}>
          <MaterialIcons name="access-time" size={14} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            {formattedDate} at {formattedTime}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  
  signalIndicator: {
    width: 4,
  },
  
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  
  provider: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
  },
  
  networkTypeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  
  networkType: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.small,
  },
  
  noConnectivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.error + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  
  noConnectivityText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.error,
  },
  
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  
  signalStrength: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.body,
  },
  
  signalLabel: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
  },
  
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  
  infoText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
  },
});
