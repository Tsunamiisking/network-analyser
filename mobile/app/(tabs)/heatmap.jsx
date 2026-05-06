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

// Lagos center coordinates
const LAGOS_REGION = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.4,
  longitudeDelta: 0.4,
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
      filters.minLat = 6.3;
      filters.maxLat = 6.8;
      filters.minLng = 3.1;
      filters.maxLng = 3.6;

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
      console.log(`✅ Loaded ${data.length} ${mode} clusters`);
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
      const color = getSignalColor(cluster.avgSignalStrength);
      return (
        <Circle
          key={`heatmap-${index}`}
          center={{
            latitude: cluster.centroid?.lat || cluster.location?.coordinates[1],
            longitude: cluster.centroid?.lng || cluster.location?.coordinates[0],
          }}
          radius={600}
          fillColor={color + '66'} // Add transparency
          strokeColor={color + 'CC'}
          strokeWidth={1}
        />
      );
    });
  };

  const renderDeadZonePolygons = () => {
    return clusters.map((cluster) => {
      if (!cluster.boundingBox) return null;
      
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
    });
  };

  const renderQualityClusters = () => {
    return clusters.map((cluster) => {
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
    });
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
        initialRegion={LAGOS_REGION}
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
            <Text style={styles.legendTitle}>Legend</Text>
            <MaterialIcons name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.strong }]} />
              <Text style={styles.legendText}>Excellent (&gt; -70 dBm)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.moderate }]} />
              <Text style={styles.legendText}>Fair (-85 to -100 dBm)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.veryWeak }]} />
              <Text style={styles.legendText}>Poor (&lt; -110 dBm)</Text>
            </View>
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
    gap: SPACING.sm,
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