import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS, getSignalColor } from '../constants/theme';

export default function ProviderCard({ provider, avgSignalStrength, sampleCount, coverage, isBest = false }) {
  // Calculate coverage from signal strength if not provided
  const calculateCoverage = (signalStrength) => {
    if (signalStrength >= -70) return 'Excellent';
    if (signalStrength >= -85) return 'Good';
    if (signalStrength >= -100) return 'Fair';
    return 'Poor';
  };
  
  const coverageLabel = coverage || calculateCoverage(avgSignalStrength);
  
  // Get coverage color based on coverage label
  const getCoverageColor = (coverageLabel) => {
    switch (coverageLabel.toLowerCase()) {
      case 'excellent':
      case 'strong':
        return COLORS.success;
      case 'good':
      case 'moderate':
        return COLORS.warning;
      case 'fair':
      case 'weak':
        return '#FB923C'; // Orange
      case 'poor':
        return COLORS.error;
      default:
        return COLORS.textMuted;
    }
  };
  
  const coverageColor = getCoverageColor(coverageLabel);
  const signalColor = getSignalColor(avgSignalStrength);
  
  // Calculate signal percentage for visual bar
  const signalPercentage = Math.max(0, Math.min(100, ((avgSignalStrength + 110) / 60) * 100));
  
  // Calculate signal bars (1-5)
  const signalBars = Math.ceil((signalPercentage / 100) * 5);
  
  return (
    <View style={[
      styles.card,
      isBest && styles.bestCard,
      isBest && SHADOWS.lg
    ]}>
      {/* Glow effect for best card */}
      {isBest && <View style={styles.glowEffect} />}
      
      {/* Best Badge */}
      {isBest && (
        <View style={styles.bestBadge}>
          <View style={styles.bestBadgeGlow}>
            <MaterialIcons name="workspace-premium" size={16} color={COLORS.warning} />
          </View>
          <Text style={styles.bestBadgeText}>RECOMMENDED</Text>
        </View>
      )}
      
      {/* Header Section */}
      <View style={styles.header}>
        {/* Provider Info */}
        <View style={styles.providerSection}>
          <View style={[
            styles.iconContainer,
            { backgroundColor: signalColor + '20' }
          ]}>
            <MaterialIcons name="cell-tower" size={28} color={signalColor} />
          </View>
          
          <View style={styles.providerTextSection}>
            <Text style={[
              styles.providerName,
              isBest && styles.providerNameBest
            ]}>
              {provider}
            </Text>
            
            {/* Signal Bars Visual */}
            <View style={styles.signalBarsContainer}>
              {[1, 2, 3, 4, 5].map((bar) => (
                <View
                  key={bar}
                  style={[
                    styles.signalBarItem,
                    { 
                      height: bar * 3 + 4,
                      backgroundColor: bar <= signalBars 
                        ? signalColor 
                        : COLORS.border
                    }
                  ]}
                />
              ))}
              <Text style={styles.signalBarsLabel}>{signalPercentage.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
        
        {/* Coverage Badge */}
        <View style={[styles.coverageBadge, { 
          backgroundColor: coverageColor + '15',
          borderColor: coverageColor + '40',
        }]}>
          <View style={[styles.coverageIndicator, { backgroundColor: coverageColor }]} />
          <Text style={[styles.coverageText, { color: coverageColor }]}>
            {coverageLabel}
          </Text>
        </View>
      </View>
      
      {/* Divider */}
      <View style={styles.divider} />
      
      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        {/* Signal Strength */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialIcons name="signal-cellular-alt" size={18} color={signalColor} />
            <Text style={styles.metricLabel}>Signal Strength</Text>
          </View>
          <Text style={[styles.metricValue, { color: signalColor }]}>
            {avgSignalStrength.toFixed(1)} <Text style={styles.metricUnit}>dBm</Text>
          </Text>
        </View>
        
        {/* Sample Count */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialIcons name="analytics" size={18} color={COLORS.info} />
            <Text style={styles.metricLabel}>Data Points</Text>
          </View>
          <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
            {sampleCount.toLocaleString()}
          </Text>
        </View>
      </View>
      
      {/* Signal Strength Visual Bar */}
      <View style={styles.progressSection}>
        <Text style={styles.progressLabel}>Coverage Quality</Text>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill,
                { 
                  backgroundColor: signalColor,
                  width: `${signalPercentage}%`
                }
              ]} 
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    overflow: 'hidden',
  },
  
  bestCard: {
    borderColor: COLORS.warning + '60',
    borderWidth: 2,
    backgroundColor: '#1F2937', // Slightly lighter for emphasis
  },
  
  // glowEffect: {
  //   position: 'absolute',
  //   top: 0,
  //   left: 0,
  //   right: 0,
  //   height: 3,
  //   backgroundColor: COLORS.warning,
  //   shadowColor: COLORS.warning,
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.8,
  //   shadowRadius: 10,
  //   elevation: 10,
  // },
  
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warning + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  
  bestBadgeGlow: {
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  
  bestBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.small,
    color: COLORS.warning,
    letterSpacing: 0.8,
  },
  
  header: {
    marginBottom: SPACING.md,
  },
  
  providerSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  providerTextSection: {
    flex: 1,
    justifyContent: 'center',
  },
  
  providerName: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  
  providerNameBest: {
    fontSize: 20,
    fontFamily: FONTS.header,
  },
  
  signalBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  
  signalBarItem: {
    width: 5,
    borderRadius: 2,
  },
  
  signalBarsLabel: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    marginLeft: 6,
  },
  
  coverageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  
  coverageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  
  coverageText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.small,
    letterSpacing: 0.3,
  },
  
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  
  metricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  
  metricLabel: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
  },
  
  metricValue: {
    fontFamily: FONTS.headerSemibold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  
  metricUnit: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
  },
  
  progressSection: {
    gap: 6,
  },
  
  progressLabel: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
  },
  
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  progressBarFill: {
    height: '100%',
    borderRadius: RADIUS.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
});
