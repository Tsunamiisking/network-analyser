import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Alert 
} from 'react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import MapView, { Circle, Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { 
  getAggregatedHeatmap, 
  getReports,
  submitNetworkData 
} from '../../services/api';
import { assembleTelemetryPacket } from '../../services/sensingService';
import { getCollectionStats } from '../../services/backgroundCollectionService';
import { recordSuccess, recordFailure } from '../../services/submissionTracker';
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
import { PROVIDERS, SIGNAL_QUALITY_LEVELS } from '../../config/api';

// Issue type visual config for report overlay markers
const ISSUE_CONFIG = {
  'No Signal':     { color: '#EF4444', icon: 'signal-wifi-off' },
  'No Data':       { color: '#F97316', icon: 'wifi-off' },
  'Slow Internet': { color: '#EAB308', icon: 'signal-wifi-2-bar' },
  'Call Drop':     { color: '#A855F7', icon: 'call-end' },
};

// Signal quality ranges aligned with the system-wide thresholds
// Must match: networkController.js classifySignalQuality, theme.js SIGNAL_THRESHOLDS
const QUALITY_RANGES = {
  excellent: { min: -85, max: 0 },      // > -85 dBm
  good:      { min: -95, max: -85 },    // -95 < signal <= -85
  fair:      { min: -105, max: -95 },   // -105 < signal <= -95
  poor:      { min: -115, max: -105 },  // -115 < signal <= -105
  very_poor: { min: -200, max: -115 },  // <= -115 dBm
};

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
  const [isContributing, setIsContributing] = useState(false);
  const [bgCollectionStatus, setBgCollectionStatus] = useState(null);
  // Report overlay state
  const [reports, setReports] = useState([]);
  const [showReports, setShowReports] = useState(true);

  // Reload data whenever this tab gains focus so reports/heatmap stay fresh
  // after the user submits something from another tab.
  useFocusEffect(
    useCallback(() => {
      loadMapData();
      loadBackgroundStatus();
    }, [mode, provider, qualityLevel])
  );

  // Also reload when filter controls change
  useEffect(() => {
    loadMapData();
    loadBackgroundStatus();
  }, [mode, provider, qualityLevel]);

  // Load background collection status
  const loadBackgroundStatus = async () => {
    try {
      const stats = await getCollectionStats();
      setBgCollectionStatus(stats);
    } catch (error) {
      console.error('Failed to load background status:', error);
    }
  };

  // Handle network data contribution
  const handleContribute = async () => {
    try {
      setIsContributing(true);
      
      // Assemble telemetry packet (includes location, signal, carrier, etc.)
      const telemetryData = await assembleTelemetryPacket();
      
      if (!telemetryData) {
        Alert.alert(
          'Location Required',
          'Please enable location services to contribute network data.'
        );
        return;
      }

      // iOS carrier detection: if provider is "iOS Carrier", let user select manually
      if (telemetryData.provider === 'iOS Carrier') {
        // Show carrier selection dialog
        Alert.alert(
          'Select Your Network Provider',
          'iOS privacy restrictions prevent automatic carrier detection. Please select your current network:',
          [
            {
              text: 'MTN',
              onPress: async () => {
                telemetryData.provider = 'MTN';
                await submitAndRefresh(telemetryData);
              }
            },
            {
              text: 'Airtel',
              onPress: async () => {
                telemetryData.provider = 'Airtel';
                await submitAndRefresh(telemetryData);
              }
            },
            {
              text: 'Glo',
              onPress: async () => {
                telemetryData.provider = 'Glo';
                await submitAndRefresh(telemetryData);
              }
            },
            {
              text: '9mobile',
              onPress: async () => {
                telemetryData.provider = '9mobile';
                await submitAndRefresh(telemetryData);
              }
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setIsContributing(false)
            }
          ],
          { cancelable: false }
        );
        return; // Exit and wait for user selection
      }

      // Android or known carrier: submit directly
      await submitAndRefresh(telemetryData);
      
    } catch (error) {
      console.error('Contribution error:', error);
      Alert.alert(
        'Submission Failed',
        error.message || 'Could not submit network data. Please try again.'
      );
      setIsContributing(false);
    }
  };

  // Helper function to submit data and refresh map
  const submitAndRefresh = async (telemetryData) => {
    try {
      await submitNetworkData(telemetryData);
      
      // Track successful manual submission
      await recordSuccess('manual');
      
      Alert.alert(
        'Success! 🎉',
        `Thank you for contributing! Signal: ${telemetryData.signalStrength}dBm, Provider: ${telemetryData.provider}`,
        [
          {
            text: 'OK',
            onPress: () => loadMapData() // Refresh map to show new data
          }
        ]
      );
    } catch (error) {
      // Track failed submission
      await recordFailure();
      throw error;
    } finally {
      setIsContributing(false);
    }
  };

  const loadMapData = async () => {
    setLoading(true);
    try {
      // All modes use the same aggregated heatmap data for consistency.
      // Quality and Dead Zone modes filter this data client-side so they
      // always match what is visible in the regular heatmap view.
      const filters = {};
      if (provider !== 'All') filters.provider = provider;

      // Fetch heatmap and user reports in parallel
      const [result, reportsResult] = await Promise.all([
        getAggregatedHeatmap({ precision: 6, ...filters }),
        getReports(provider !== 'All' ? { provider } : {}),
      ]);

      const allData = result.data || [];
      // Reports are qualitative event markers — stored separately from signal measurements
      setReports(reportsResult.data || []);

      let data = allData;

      if (mode === MODES.QUALITY) {
        // Filter geohash cells whose median signal falls in the selected quality band
        const range = QUALITY_RANGES[qualityLevel];
        if (range) {
          data = allData.filter(d =>
            d.medianSignalStrength > range.min && d.medianSignalStrength <= range.max
          );
        }
      } else if (mode === MODES.DEAD_ZONES) {
        // Dead zones = geohash cells with consistently very poor signal (≤ -115 dBm).
        // Using the same data as the heatmap prevents false dead zones in good-signal areas.
        data = allData.filter(d => d.medianSignalStrength <= -115);
      }

      setClusters(data);
    } catch (error) {
      console.error('Failed to load map data:', error);
      Alert.alert('Error', 'Failed to load map data. Please try again.');
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  // Render user-submitted issue report markers on the map.
  // These are qualitative event markers, distinct from the quantitative signal heatmap.
  const renderReportMarkers = () => {
    if (!showReports) return null;
    return reports.map((report, index) => {
      const lat = report.location?.coordinates?.[1];
      const lng = report.location?.coordinates?.[0];
      if (!lat || !lng) return null;

      const config = ISSUE_CONFIG[report.issueType] || { color: COLORS.textMuted, icon: 'report-problem' };
      // Use occurredAt (when the issue happened) if provided, else fall back to submission time
      const eventTime = report.occurredAt || report.timestamp;
      const timeAgo = (() => {
        if (!eventTime) return '';
        const diff = new Date() - new Date(eventTime);
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      })();

      // If the user reported it significantly after the event, note the lag
      const reportedLater = (() => {
        if (!report.occurredAt || !report.timestamp) return null;
        const lagMins = Math.round(
          (new Date(report.timestamp) - new Date(report.occurredAt)) / 60000
        );
        if (lagMins < 5) return null;
        if (lagMins < 60) return `reported ${lagMins}m later`;
        return `reported ${Math.floor(lagMins / 60)}h later`;
      })();

      return (
        <Marker
          key={`report-${index}`}
          coordinate={{ latitude: lat, longitude: lng }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          {/* Custom pin: colored circle with icon */}
          <View style={[styles.reportPin, { backgroundColor: config.color }]}>
            <MaterialIcons name={config.icon} size={12} color="#fff" />
          </View>

          {/* Callout shown on tap */}
          <Callout tooltip>
            <View style={styles.reportCallout}>
              <Text style={[styles.reportCalloutIssue, { color: config.color }]}>
                {report.issueType}
              </Text>
              <Text style={styles.reportCalloutProvider}>{report.provider} · {timeAgo}</Text>
              {reportedLater ? (
                <Text style={styles.reportCalloutLag}>{reportedLater}</Text>
              ) : null}
              {report.description ? (
                <Text style={styles.reportCalloutDesc}>{report.description}</Text>
              ) : null}
            </View>
          </Callout>
        </Marker>
      );
    }).filter(Boolean);
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

  // Dead zones: render red circles using the same aggregated heatmap data format.
  // Only called for cells with medianSignalStrength <= -115 (already filtered in loadMapData).
  const renderDeadZoneCircles = () => {
    return clusters.map((cluster, index) => {
      const lat = cluster.location?.coordinates?.[1];
      const lng = cluster.location?.coordinates?.[0];
      if (!lat || !lng) return null;

      return (
        <Circle
          key={`deadzone-${index}`}
          center={{ latitude: lat, longitude: lng }}
          radius={700}
          fillColor="rgba(239, 68, 68, 0.35)"
          strokeColor="rgba(239, 68, 68, 0.85)"
          strokeWidth={2}
        />
      );
    }).filter(Boolean);
  };

  // Quality clusters: already filtered to the selected quality band in loadMapData.
  // Reuses the heatmap circle renderer so colours and radius stay consistent.
  const renderQualityClusters = () => renderHeatmapCircles();

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
        {!loading && mode === MODES.DEAD_ZONES && renderDeadZoneCircles()}
        {!loading && mode === MODES.QUALITY && renderQualityClusters()}
        {/* Report overlay: user-reported issues as pins, always visible on all modes */}
        {renderReportMarkers()}
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
            {mode === MODES.HEATMAP && '📊 Median signal strength per area'}
            {mode === MODES.DEAD_ZONES && '🔴 Areas where median signal is Very Poor (≤ -115 dBm)'}
            {mode === MODES.QUALITY && `🎯 Showing areas with ${qualityLevel.replace('_', ' ')} signal`}
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
          {!loading && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{clusters.length}</Text>
                <Text style={styles.statLabel}>
                  {mode === MODES.DEAD_ZONES ? 'Dead Zones' : 'Areas'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {clusters.reduce((sum, c) => sum + (c.count || 0), 0)}
                </Text>
                <Text style={styles.statLabel}>Readings</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{reports.length}</Text>
                <Text style={styles.statLabel}>Reports</Text>
              </View>
            </View>
          )}

          {/* Report overlay toggle row */}
          <TouchableOpacity
            style={styles.reportToggleRow}
            onPress={() => setShowReports(v => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.reportToggleLeft}>
              <MaterialIcons
                name="report-problem"
                size={16}
                color={showReports ? '#EF4444' : COLORS.textMuted}
              />
              <Text style={[styles.reportToggleLabel, showReports && styles.reportToggleLabelActive]}>
                Show Issue Reports
              </Text>
              {reports.length === 0 && (
                <Text style={styles.reportToggleHint}> — none submitted yet</Text>
              )}
            </View>
            <View style={[styles.reportToggleSwitch, showReports && styles.reportToggleSwitchOn]}>
              <View style={[styles.reportToggleThumb, showReports && styles.reportToggleThumbOn]} />
            </View>
          </TouchableOpacity>
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
            {mode === MODES.HEATMAP && 'Median signal per ~1.2km cell'}
            {mode === MODES.DEAD_ZONES && 'Cells with median signal ≤ -115 dBm'}
            {mode === MODES.QUALITY && `Cells with ${qualityLevel.replace('_', ' ')} signal`}
          </Text>
          
          <View style={styles.legendItems}>
            {mode === MODES.HEATMAP && (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.strong }]} />
                  <Text style={styles.legendText}>Excellent</Text>
                  <Text style={styles.legendSubtext}>&gt; -85</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#84cc16' }]} />
                  <Text style={styles.legendText}>Good</Text>
                  <Text style={styles.legendSubtext}>-95 to -85</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.moderate }]} />
                  <Text style={styles.legendText}>Fair</Text>
                  <Text style={styles.legendSubtext}>-105 to -95</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.weak }]} />
                  <Text style={styles.legendText}>Poor</Text>
                  <Text style={styles.legendSubtext}>-115 to -105</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: SIGNAL_COLORS.veryWeak }]} />
                  <Text style={styles.legendText}>Very Poor</Text>
                  <Text style={styles.legendSubtext}>&le; -115</Text>
                </View>
              </>
            )}
            
            {mode === MODES.DEAD_ZONES && (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: 'rgba(239, 68, 68, 0.6)' }]} />
                  <Text style={styles.legendText}>Dead Zone</Text>
                  <Text style={styles.legendSubtext}>≤ -115 dBm</Text>
                </View>
                <View style={styles.legendNote}>
                  <MaterialIcons name="info-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.legendNoteText}>
                    Matches Very Poor areas in heatmap
                  </Text>
                </View>
              </>
            )}
            
            {mode === MODES.QUALITY && (
              <>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: getQualityColor(qualityLevel) }]} />
                  <Text style={styles.legendText}>{qualityLevel.replace('_', ' ').toUpperCase()}</Text>
                  <Text style={styles.legendSubtext}>
                    {QUALITY_RANGES[qualityLevel]?.min === -200
                      ? '≤ -115 dBm'
                      : QUALITY_RANGES[qualityLevel]?.min === -85
                      ? '> -85 dBm'
                      : `${QUALITY_RANGES[qualityLevel]?.min} to ${QUALITY_RANGES[qualityLevel]?.max} dBm`
                    }
                  </Text>
                </View>
                <View style={styles.legendNote}>
                  <MaterialIcons name="info-outline" size={12} color={COLORS.textMuted} />
                  <Text style={styles.legendNoteText}>
                    Same data as heatmap, filtered by quality
                  </Text>
                </View>
              </>
            )}  
          </View>

          {/* Report overlay legend — always shown */}
          <View style={[styles.legendNote, { marginTop: SPACING.md, marginBottom: SPACING.sm }]}>
            <MaterialIcons name="report-problem" size={12} color={COLORS.textMuted} />
            <Text style={styles.legendNoteText}>
              Pins = user-reported issues (tap to see details)
            </Text>
          </View>
          <View style={styles.legendItems}>
            {Object.entries(ISSUE_CONFIG).map(([issueType, cfg]) => (
              <View key={issueType} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: cfg.color }]} />
                <Text style={styles.legendText}>{issueType}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Contribute Button */}
      <TouchableOpacity 
        style={styles.contributeButton}
        onPress={handleContribute}
        disabled={isContributing}
      >
        {isContributing ? (
          <ActivityIndicator size="small" color={COLORS.textPrimary} />
        ) : (
          <MaterialIcons name="add-location" size={24} color={COLORS.success} />
        )}
      </TouchableOpacity>

      {/* Refresh Button */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={loadMapData}
      >
        <MaterialIcons name="refresh" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      {/* Background Collection Status */}
      {bgCollectionStatus?.enabled && bgCollectionStatus?.lastCollectionTime && (
        <View style={styles.statusBadge}>
          <MaterialIcons name="sensors" size={14} color={COLORS.success} />
          <Text style={styles.statusBadgeText}>
            {(() => {
              const diff = new Date() - new Date(bgCollectionStatus.lastCollectionTime);
              const minutes = Math.floor(diff / 60000);
              if (minutes < 1) return 'Just now';
              if (minutes < 60) return `${minutes}m ago`;
              return `${Math.floor(minutes / 60)}h ago`;
            })()}
          </Text>
        </View>
      )}

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
  contributeButton: {
    position: 'absolute',
    bottom: 30,
    right: 80,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.round,
    padding: SPACING.md,
    ...SHADOWS.lg,
    zIndex: 3,
  },
  reportToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reportToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  reportToggleLabel: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
  },
  reportToggleLabelActive: {
    color: '#EF4444',
  },
  reportToggleHint: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.tiny,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  reportToggleSwitch: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.border,
    padding: 2,
    justifyContent: 'center',
  },
  reportToggleSwitchOn: {
    backgroundColor: '#EF444460',
  },
  reportToggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.textMuted,
  },
  reportToggleThumbOn: {
    backgroundColor: '#EF4444',
    alignSelf: 'flex-end',
  },
  reportPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    ...SHADOWS.md,
  },
  reportCallout: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    minWidth: 160,
    maxWidth: 220,
    ...SHADOWS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportCalloutIssue: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.body,
    marginBottom: 2,
  },
  reportCalloutProvider: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  reportCalloutLag: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.tiny,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  reportCalloutDesc: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    fontStyle: 'italic',
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
  statusBadge: {
    position: 'absolute',
    top: 80,
    left: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    ...SHADOWS.md,
    zIndex: 3,
  },
  statusBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
  },
});