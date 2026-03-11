/**
 * Design System - Network Analyzer
 * Based on telecom analytics dark theme
 */

// SIGNAL STRENGTH COLORS
export const SIGNAL_COLORS = {
  strong: '#22C55E',      // Green - Strong signal
  moderate: '#FACC15',    // Yellow - Moderate signal
  weak: '#FB923C',        // Orange - Weak signal
  veryWeak: '#EF4444',    // Red - Very weak / blackout
};

// BASE COLORS
export const COLORS = {
  // Background
  background: '#0F172A',     // Dark background
  card: '#1E293B',           // Dark gray cards
  
  // Text
  textPrimary: '#FFFFFF',    // White
  textSecondary: '#94A3B8',  // Light gray
  textMuted: '#64748B',      // Muted gray
  
  // Provider specific (optional)
  mtn: '#FFCC00',
  airtel: '#ED1C24',
  glo: '#00A651',
  mobile9: '#006F3C',
  
  // UI Elements
  border: '#334155',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  // Status colors
  success: '#22C55E',
  warning: '#FACC15',
  error: '#EF4444',
  info: '#3B82F6',
};

// TYPOGRAPHY
export const FONT_SIZES = {
  header: 24,        // Headers
  title: 18,         // Section titles
  body: 14,          // Body text
  small: 12,         // Small labels
  tiny: 10,          // Very small text
};

export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

// FONT FAMILIES
export const FONTS = {
  // Headers & Titles (Poppins)
  header: 'Poppins_700Bold',
  headerSemibold: 'Poppins_600SemiBold',
  headerMedium: 'Poppins_500Medium',
  
  // Body Text (Inter)
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

// SPACING
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// BORDER RADIUS
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

// SHADOWS
export const SHADOWS = {
  sm: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  lg: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
};

// PROVIDERS
export const PROVIDERS = ['MTN', 'Airtel', 'Glo', '9mobile'];

// NETWORK TYPES
export const NETWORK_TYPES = ['2G', '3G', '4G', '5G'];

// SIGNAL STRENGTH THRESHOLDS (in dBm)
export const SIGNAL_THRESHOLDS = {
  strong: -70,       // >= -70 dBm
  moderate: -85,     // >= -85 dBm
  weak: -100,        // >= -100 dBm
  veryWeak: -120,    // < -100 dBm
};

/**
 * Get signal color based on dBm value
 * @param {number} signalStrength - Signal strength in dBm
 * @returns {string} Hex color code
 */
export const getSignalColor = (signalStrength) => {
  if (signalStrength >= SIGNAL_THRESHOLDS.strong) return SIGNAL_COLORS.strong;
  if (signalStrength >= SIGNAL_THRESHOLDS.moderate) return SIGNAL_COLORS.moderate;
  if (signalStrength >= SIGNAL_THRESHOLDS.weak) return SIGNAL_COLORS.weak;
  return SIGNAL_COLORS.veryWeak;
};

/**
 * Get signal label based on dBm value
 * @param {number} signalStrength - Signal strength in dBm
 * @returns {string} Signal quality label
 */
export const getSignalLabel = (signalStrength) => {
  if (signalStrength >= SIGNAL_THRESHOLDS.strong) return 'Strong';
  if (signalStrength >= SIGNAL_THRESHOLDS.moderate) return 'Moderate';
  if (signalStrength >= SIGNAL_THRESHOLDS.weak) return 'Weak';
  return 'Very Weak';
};

export default {
  SIGNAL_COLORS,
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  PROVIDERS,
  NETWORK_TYPES,
  SIGNAL_THRESHOLDS,
  getSignalColor,
  getSignalLabel,
};
