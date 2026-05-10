import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useState, useEffect } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import SignalHistoryCard from "../../components/SignalHistoryCard";
import { getMyHistory } from "../../services/api";
import { getDeviceId } from "../../utils/helpers";
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
} from "../../constants/theme";
import PageHeader from "../../components/PageHeader";
import { SafeAreaView } from "react-native-safe-area-context";

export default function History() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [historyData, setHistoryData] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(50); // Default to showing last 50

  // Initialize device ID and load data
  useEffect(() => {
    initializeHistory();
  }, []);

  // Reload when limit changes
  useEffect(() => {
    if (deviceId) {
      fetchHistory();
    }
  }, [limit, deviceId]);

  const initializeHistory = async () => {
    try {
      const id = await getDeviceId();
      setDeviceId(id);
      if (id) {
        await fetchHistory(id);
      }
    } catch (err) {
      console.error('Error initializing history:', err);
      setError('Failed to initialize history');
      setIsLoading(false);
    }
  };

  const fetchHistory = async (id = deviceId) => {
    if (!id) return;
    
    try {
      setError(null);
      const response = await getMyHistory(id, limit);
      setHistoryData(response.data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to load history. Pull to refresh.');
      setHistoryData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  // Adjust limit
  const showMore = () => {
    setLimit((prev) => prev + 25);
  };

  const showLess = () => {
    setLimit(50);
  };

  // Empty state component
  const EmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons 
        name={error ? "error-outline" : "history"} 
        size={80} 
        color={error ? COLORS.error : COLORS.textMuted} 
      />
      <Text style={styles.emptyTitle}>
        {error ? "Unable to Load History" : "No History Yet"}
      </Text>
      <Text style={styles.emptyText}>
        {error 
          ? error 
          : "Your signal measurements will appear here"}
      </Text>
      {error && (
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={fetchHistory}
        >
          <MaterialIcons name="refresh" size={20} color={COLORS.textPrimary} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Header component
  const ListHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.headerSubtitle}>
            Showing {historyData.length} measurement{historyData.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Adjust Limit Controls */}
        {historyData.length >= limit && (
          <TouchableOpacity style={styles.filterButton} onPress={showMore}>
            <MaterialIcons name="expand-more" size={18} color={COLORS.info} />
            <Text style={styles.filterButtonText}>Show More</Text>
          </TouchableOpacity>
        )}

        {limit > 50 && (
          <TouchableOpacity style={styles.filterButton} onPress={showLess}>
            <MaterialIcons
              name="expand-less"
              size={18}
              color={COLORS.textMuted}
            />
            <Text style={styles.filterButtonText}>Show Less</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Limit Info Badge */}
      {limit > 50 && (
        <View style={styles.limitBadge}>
          <MaterialIcons
            name="filter-list"
            size={14}
            color={COLORS.textMuted}
          />
          <Text style={styles.limitBadgeText}>
            Showing last {limit} records
          </Text>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.info} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="History" />
      <FlatList
        data={historyData}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <SignalHistoryCard item={item} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={
          historyData.length === 0
            ? styles.emptyListContent
            : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.info}
            colors={[COLORS.info]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    backgroundColor: COLORS.background,
  },

  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },

  listContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },

  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
  },

  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  filterButtonText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.info,
  },

  limitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    alignSelf: "flex-start",
  },

  limitBadgeText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },

  emptyTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: SPACING.md,
  },

  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
  },

  retryButtonText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
  },
});
