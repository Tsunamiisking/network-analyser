import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, getSignalColor } from '../constants/theme';

export default function ProviderCard({ provider, avgSignalStrength, sampleCount, coverage, isBest = false }) {
  // Get coverage color based on coverage label
  const getCoverageColor = (coverageLabel) => {
    switch (coverageLabel.toLowerCase()) {
      case 'strong':
        return COLORS.success;
      case 'moderate':
        return COLORS.warning;
      case 'weak':
        return COLORS.danger;
      default:
        return COLORS.textMuted;
    }
  };
  
  const coverageColor = getCoverageColor(coverage);
  const signalColor = getSignalColor(avgSignalStrength);
  
  return (
    <View style={[
      styles.card,
      isBest && styles.bestCard
    ]}>
      {/* Best Badge */}
      {isBest && (
        <View style={styles.bestBadge}>
          <MaterialIcons name="star" size={16} color={COLORS.warning} />
          <Text style={styles.bestBadgeText}>BEST NETWORK</Text>
        </View>
      )}
      
      {/* Provider Name */}
      <View style={styles.header}>
        <View style={styles.providerInfo}>
          <MaterialIcons name="cell-tower" size={24} color={COLORS.info} />
          <Text style={[
            styles.providerName,
            isBest && styles.providerNameBest
          ]}>
            {provider}
          </Text>
        </View>
        
        {/* Coverage Badge */}
        <View style={[styles.coverageBadge, { backgroundColor: coverageColor + '20' }]}>
          <View style={[styles.coverageIndicator, { backgroundColor: coverageColor }]} />
          <Text style={[styles.coverageText, { color: coverageColor }]}>
            {coverage}
          </Text>
        </View>
      </View>
      
      {/* Metrics */}
      <View style={styles.metrics}>
        {/* Signal Strength */}
        <View style={styles.metric}>
          <MaterialIcons name="signal-cellular-alt" size={20} color={signalColor} />
          <View style={styles.metricContent}>
            <Text style={styles.metricLabel}>Avg Signal</Text>
            <Text style={[styles.metricValue, { color: signalColor }]}>
              {avgSignalStrength} dBm
            </Text>
          </View>
        </View>
        
        {/* Sample Count */}
        <View style={styles.metric}>
          <MaterialIcons name="apps" size={20} color={COLORS.info} />
          <View style={styles.metricContent}>
            <Text style={styles.metricLabel}>Samples</Text>
            <Text style={styles.metricValue}>
              {sampleCount.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
      
      {/* Signal Strength Visual Bar */}
      <View style={styles.signalBar}>
        <View style={styles.signalBarBackground}>
          <View 
            style={[
              styles.signalBarFill,
              { 
                backgroundColor: signalColor,
                // Convert dBm to percentage (assuming -50 to -110 range)
                width: `${Math.max(0, Math.min(100, ((avgSignalStrength + 110) / 60) * 100))}%`
              }
            ]} 
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  bestCard: {
    borderColor: COLORS.warning,
    borderWidth: 2,
  },
  
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  
  bestBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.small,
    color: COLORS.warning,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  
  providerName: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
  },
  
  providerNameBest: {
    fontSize: FONT_SIZES.header,
  },
  
  coverageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  
  coverageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  coverageText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.small,
  },
  
  metrics: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  
  metric: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  
  metricContent: {
    flex: 1,
  },
  
  metricLabel: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  
  metricValue: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
  },
  
  signalBar: {
    marginTop: SPACING.sm,
  },
  
  signalBarBackground: {
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  
  signalBarFill: {
    height: '100%',
    borderRadius: RADIUS.sm,
  },
});
