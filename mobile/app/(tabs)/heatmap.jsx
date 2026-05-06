import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Alert 
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import MapView, { Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { 
  getAggregatedHeatmap, 
  getDeadZoneClusters, 
  getSignalQualityClusters 
} from '../../services/api';
import { 
  COLORS, 
  FONTS, 
  FONT_SIZES, 
  SPACING, 
  RADIUS, 
  SHADOWS,
  SIGNAL_COLORS,
  getSignalColor 
} from '../../constants/theme';
import { PROVIDERS, SIGNAL_QUALITY_LEVELS, DBSCAN_DEFAULTS } from '../../config/api';

// Nigeria SW region (covers Lagos, Ibadan, and surrounding areas)
const INITIAL_REGION = {
  latitude: 6.9,  // Between Lagos (6.5) and Ibadan (7.4)
  longitude: 3.6,
  latitudeDelta: 1.5,  // Covers both cities
  longitudeDelta: 1.2,
};

// Visualization modes
const MODES = {
  HEATMAP: 'heatmap',
  DEAD_ZONES: 'deadzones',
  QUALITY: 'quality',
};

export default function Heatmap() {
  const mapRef = useRef(null);
  
  // State management
  const [mode, setMode] = useState(MODES.HEATMAP);
  const [provider, setProvider] = useState('All');
  const [qualityLevel, setQualityLevel] = useState(SIGNAL_QUALITY_LEVELS.EXCELLENT);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Load data when mode, provider, or quality changes
  useEffect(() => {
    loadMapData();
  }, [mode, provider, qualityLevel]);

  const loadMapData = async () => {
    setLoading(true);
    try {
      let data = [];
      
      // Build filters, removing undefined values
      const filters = {};
      if (provider !== 'All') filters.provider = provider;
      // Removed hardcoded bounding box - show all available data
      // Backend will return all data within Nigeria (geo-fenced at API level)

      switch (mode) {
        case MODES.HEATMAP:
          const result = await getAggregatedHeatmap({
            precision: 6,
            ...filters,
          });
          data = result.data || []; // Extract data array from response
          break;

        case MODES.DEAD_ZONES:
          const deadZones = await getDeadZoneClusters({
            epsilon: DBSCAN_DEFAULTS.DEAD_ZONE_EPSILON,
            minPoints: DBSCAN_DEFAULTS.DEAD_ZONE_MIN_POINTS,
            ...filters,
          });
          data = deadZones.clusters || [];
          break;

        case MODES.QUALITY:
          const quality = await getSignalQualityClusters({
            qualityLevel,
            epsilon: DBSCAN_DEFAULTS.QUALITY_EPSILON,
            minPoints: DBSCAN_DEFAULTS.QUALITY_MIN_POINTS,
            ...filters,
          });
          data = quality.clusters || [];
          break;
      }

      setClusters(data);
      // console.log(`✅ Loaded ${data.length} ${mode} items`);
      if (data.length > 0) {
        // console.log('Sample data structure:', JSON.stringify(data[0], null, 2));
      }
    } catch (error) {
      console.error('Failed to load map data:', error);
      Alert.alert('Error', 'Failed to load map data. Please try again.');
      setClusters([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const renderHeatmapCircles = () => {
    return clusters.map((cluster, index) => {
      // Extract coordinates with fallbacks
      const lat = cluster.centroid?.lat || cluster.location?.coordinates?.[1];
      const lng = cluster.centroid?.lng || cluster.location?.coordinates?.[0];
      
      // Skip if no valid coordinates
      if (!lat || !lng) {
        console.warn('Cluster missing coordinates:', cluster);
        return null;
      }
      
      // Use median signal strength for more accurate representation
      const signalStrength = cluster.medianSignalStrength ?? cluster.avgSignalStrength;
      const color = getSignalColor(signalStrength);
      
      return (
        <Circle
          key={`heatmap-${index}`}
          center={{
            latitude: lat,
            longitude: lng,
          }}
          radius={600}
          fillColor={color + '66'} // Add transparency
          strokeColor={color + 'CC'}
          strokeWidth={1}
        />
      );
    }).filter(Boolean);
  };

  const renderDeadZonePolygons = () => {
    return clusters.map((cluster) => {
      // Validate bounding box exists
      if (!cluster.boundingBox || 
          !cluster.boundingBox.minLat || 
          !cluster.boundingBox.maxLat || 
          !cluster.boundingBox.minLng || 
          !cluster.boundingBox.maxLng) {
        console.warn('Dead zone cluster missing bounding box:', cluster);
        return null;
      }
      
      const coords = [
        { 
          latitude: cluster.boundingBox.minLat, 
          longitude: cluster.boundingBox.minLng 
        },
        { 
          latitude: cluster.boundingBox.maxLat, 
          longitude: cluster.boundingBox.minLng 
        },
        { 
          latitude: cluster.boundingBox.maxLat, 
          longitude: cluster.boundingBox.maxLng 
        },
        { 
          latitude: cluster.boundingBox.minLat, 
          longitude: cluster.boundingBox.maxLng 
        },
      ];

      return (
        <Polygon
          key={`deadzone-${cluster.id}`}
          coordinates={coords}
          fillColor="rgba(239, 68, 68, 0.3)"
          strokeColor="rgba(239, 68, 68, 0.8)"
          strokeWidth={2}
        />
      );
    }).filter(Boolean);
  };

  const renderQualityClusters = () => {
    return clusters.map((cluster) => {
      // Safety check for centroid
      if (!cluster.centroid || !cluster.centroid.lat || !cluster.centroid.lng) {
        console.warn('Cluster missing centroid:', cluster);
        return null;
      }
      
      const color = getSignalColor(cluster.metrics?.avgSignalStrength || -100);
      return (
        <Circle
          key={`quality-${cluster.id}`}
          center={{
            latitude: cluster.centroid.lat,
            longitude: cluster.centroid.lng,
          }}
          radius={800}
          fillColor={color + '4D'} // 30% transparency
          strokeColor={color + 'CC'}
          strokeWidth={2}
        />
      );
    }).filter(Boolean); // Remove null entries
  };

  const getQualityColor = (level) => {
    switch (level) {
      case SIGNAL_QUALITY_LEVELS.EXCELLENT:
        return SIGNAL_COLORS.strong;
      case SIGNAL_QUALITY_LEVELS.GOOD:
        return '#84cc16'; // lime
      case SIGNAL_QUALITY_LEVELS.FAIR:
        return SIGNAL_COLORS.moderate;
      case SIGNAL_QUALITY_LEVELS.POOR:
        return SIGNAL_COLORS.weak;
      case SIGNAL_QUALITY_LEVELS.VERY_POOR:
        return SIGNAL_COLORS.veryWeak;
      default:
        return COLORS.textMuted;
    }
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {!loading && mode === MODES.HEATMAP && renderHeatmapCircles()}
        {!loading && mode === MODES.DEAD_ZONES && renderDeadZonePolygons()}
        {!loading && mode === MODES.QUALITY && renderQualityClusters()}
      </MapView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.info} />
          <Text style={styles.loadingText}>Loading map data...</Text>
        </View>
      )}

      {/* Top Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setShowControls(!showControls)}
        >
          <MaterialIcons 
            name={showControls ? "expand-less" : "expand-more"} 
            size={24} 
            color={COLORS.textPrimary} 
          />
        </TouchableOpacity>
      </View>

      {/* Control Panel */}
      {showControls && (
        <View style={styles.controlPanel}>
          <Text style={styles.controlTitle}>Visualization Mode</Text>
          
          {/* Mode Description */}
          <Text style={styles.modeDescription}>
            {mode === MODES.HEATMAP && '📊 Typical signal strength per area (median value)'}
            {mode === MODES.DEAD_ZONES && '⚠️ Areas with no connectivity detected'}
            {mode === MODES.QUALITY && '🎯 Filter by specific signal quality levels'}
          </Text>
          
          {/* Mode Selector */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, mode === MODES.HEATMAP && styles.modeButtonActive]}
              onPress={() => setMode(MODES.HEATMAP)}
            >
              <MaterialIcons 
                name="bubble-chart" 
                size={20} 
                color={mode === MODES.HEATMAP ? COLORS.info : COLORS.textSecondary} 
              />
              <Text style={[
                styles.modeButtonText,
                mode === MODES.HEATMAP && styles.modeButtonTextActive
              ]}>
                Heatmap
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, mode === MODES.DEAD_ZONES && styles.modeButtonActive]}
              onPress={() => setMode(MODES.DEAD_ZONES)}
            >
              <MaterialIcons 
                name="warning" 
                size={20} 
                color={mode === MODES.DEAD_ZONES ? COLORS.error : COLORS.textSecondary} 
              />
              <Text style={[
                styles.modeButtonText,
                mode === MODES.DEAD_ZONES && styles.modeButtonTextActive
              ]}>
                Dead Zones
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, mode === MODES.QUALITY && styles.modeButtonActive]}
              onPress={() => setMode(MODES.QUALITY)}
            >
              <MaterialIcons 
                name="trending-up" 
                size={20} 
                color={mode === MODES.QUALITY ? COLORS.success : COLORS.textSecondary} 
              />
              <Text style={[
                styles.modeButtonText,
                mode === MODES.QUALITY && styles.modeButtonTextActive
              ]}>
                Quality
              </Text>
            </TouchableOpacity>
          </View>

          {/* Provider Filter */}
          <Text style={styles.controlSubtitle}>Provider Filter</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.providerScroll}
          >
            <TouchableOpacity
              style={[styles.providerChip, provider === 'All' && styles.providerChipActive]}
              onPress={() => setProvider('All')}
            >
              <Text style={[
                styles.providerChipText,
                provider === 'All' && styles.providerChipTextActive
              ]}>
                All
              </Text>
            </TouchableOpacity>

            {PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.providerChip, provider === p && styles.providerChipActive]}
                onPress={() => setProvider(p)}
              >
                <Text style={[
                  styles.providerChipText,
                  provider === p && styles.providerChipTextActive
                ]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Quality Level Selector (only show in Quality mode) */}
          {mode === MODES.QUALITY && (
            <>
              <Text style={styles.controlSubtitle}>Signal Quality</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.providerScroll}
              >
                {Object.entries(SIGNAL_QUALITY_LEVELS).map(([key, value]) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.qualityChip,
                      qualityLevel === value && styles.qualityChipActive,
                      { borderColor: getQualityColor(value) }
                    ]}
                    onPress={() => setQualityLevel(value)}
                  >
                    <Text style={[
                      styles.qualityChipText,
                      qualityLevel === value && { color: getQualityColor(value) }
                    ]}>
                      {key.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Stats */}
          {!loading && clusters.length > 0 && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{clusters.length}</Text>
                <Text style={styles.statLabel}>
                  {mode === MODES.HEATMAP ? 'Areas' : 'Clusters'}
                </Text>
              </View>
              {mode !== MODES.HEATMAP && clusters[0]?.pointCount && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {clusters.reduce((sum, c) => sum + (c.pointCount || 0), 0)}
                  </Text>
                  <Text style={styles.statLabel}>Data Points</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Legend */}
      {showLegend && (
        <View style={styles.legend}>
          <TouchableOpacity 
            style={styles.legendHeader}
            onPress={() => setShowLegend(false)}
          >
            <Text style={styles.legendTitle}>
              {mode === MODES.HEATMAP && 'Signal Strength Guide'}
              {mode === MODES.DEAD_ZONES && 'Dead Zone Areas'}
              {mode === MODES.QUALITY && 'Quality Clusters'}
            </Text>
            <MaterialIcons name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          
          {/* Mode-specific descriptions */}
          <Text style={styles.legendDescription}>
            {mode === MODES.HEATMAP && 'Median signal per 1.2km area'}
            {mode === MODES.DEAD_ZONES && 'Areas with connection failures'}
            {mode === MODES.QUALITY && `${qualityLevel.replace('_', ' ')} areas (DBSCAN)`}
          </Text>
          
          <View style={styles.legendItems}>
            {mode === MODES.HEATMAP && (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.strong }]} />
                  <Text style={styles.legendText}>Excellent</Text>
                  <Text style={styles.legendSubtext}>≥ -70</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#84cc16' }]} />
                  <Text style={styles.legendText}>Good</Text>
                  <Text style={styles.legendSubtext}>-71 to -85</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.moderate }]} />
                  <Text style={styles.legendText}>Fair</Text>
                  <Text style={styles.legendSubtext}>-86 to -100</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.weak }]} />
                  <Text style={styles.legendText}>Poor</Text>
                  <Text style={styles.legendSubtext}>-101 to -110</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.veryWeak }]} />
                  <Text style={styles.legendText}>Very Poor</Text>
                  <Text style={styles.legendSubtext}> -110</Text>
                </View>
              </>
            )}
            
            {mode === MODES.DEAD_ZONES && (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: 'rgba(239, 68, 68, 0.6)' }]} />
                  <Text style={styles.legendText}>Dead Zone</Text>
                  <Text style={styles.legendSubtext}>No signal</Text>
                </View>
                <View style={styles.legendNote}>
                  <MaterialIcons name="info-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.legendNoteText}>
                    Larger areas = worse coverage
                  </Text>
                </View>
              </>
            )}
            
            {mode === MODES.QUALITY && (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: getQualityColor(qualityLevel) }]} />
                  <Text style={styles.legendText}>{qualityLevel.replace('_', ' ').toUpperCase()}</Text>
                  <Text style={styles.legendSubtext}>AI clusters</Text>
                </View>
                <View style={styles.legendNote}>
                  <MaterialIcons name="info-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.legendNoteText}>
                    Use filter above to change level
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Refresh Button */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={loadMapData}
      >
        <MaterialIcons name="refresh" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      {/* Legend Toggle (when closed) */}
      {!showLegend && (
        <TouchableOpacity 
          style={styles.legendToggle}
          onPress={() => setShowLegend(true)}
        >
          <MaterialIcons name="info-outline" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.body,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    right: SPACING.md,
    zIndex: 5,
  },
  toggleButton: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    ...SHADOWS.md,
  },
  controlPanel: {
    position: 'absolute',
    top: 90,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.lg,
    zIndex: 4,
  },
  controlTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  modeDescription: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
  controlSubtitle: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeButtonActive: {
    backgroundColor: COLORS.info + '20',
    borderColor: COLORS.info,
  },
  modeButtonText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
  },
  modeButtonTextActive: {
    color: COLORS.info,
  },
  providerScroll: {
    marginBottom: SPACING.sm,
  },
  providerChip: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  providerChipActive: {
    backgroundColor: COLORS.info + '20',
    borderColor: COLORS.info,
  },
  providerChipText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
  },
  providerChipTextActive: {
    color: COLORS.info,
  },
  qualityChip: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
    marginRight: SPACING.sm,
    borderWidth: 2,
  },
  qualityChipActive: {
    backgroundColor: COLORS.card,
  },
  qualityChipText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONTS.headerSemibold,
    fontSize: 24,
    color: COLORS.info,
  },
  statLabel: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  legend: {
    position: 'absolute',
    bottom: 100,
    left: SPACING.md,
    right: SPACING.md,
    maxWidth: 320,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.lg,
    zIndex: 3,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  legendTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
  },
  legendItems: {
    gap: SPACING.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.sm,
  },
  legendText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    flex: 1,
  },
  legendSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  legendDescription: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    lineHeight: 15,
  },
  legendNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  legendNoteText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 30,
    right: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.round,
    padding: SPACING.md,
    ...SHADOWS.lg,
    zIndex: 3,
  },
  legendToggle: {
    position: 'absolute',
    bottom: 100,
    left: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.round,
    padding: SPACING.sm,
    ...SHADOWS.md,
    zIndex: 3,
  },
});