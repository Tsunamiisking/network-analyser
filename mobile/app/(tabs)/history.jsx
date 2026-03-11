import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import SignalHistoryCard from '../../components/SignalHistoryCard';
import { MOCK_SIGNAL_HISTORY } from '../../constants/mockData';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function History() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [limit, setLimit] = useState(20); // Default to showing last 20
  
  // Using mock data - will replace with API call later
  const allData = MOCK_SIGNAL_HISTORY.data;
  const historyData = allData.slice(0, limit);
  const hasMore = allData.length > limit;
  
  // Simulated refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Replace with actual API call with limit parameter
    // await fetchSignalHistory(limit);
    setTimeout(() => setRefreshing(false), 1000);
  };
  
  // Load more data
  const loadMore = () => {
    setLimit(prev => Math.min(prev + 20, allData.length));
  };
  
  // Show all data
  const showAll = () => {
    setLimit(allData.length);
  };
  
  // Reset to default
  const showLess = () => {
    setLimit(20);
  };
  
  // Empty state component
  const EmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="history" size={80} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>No History Yet</Text>
      <Text style={styles.emptyText}>
        Your signal measurements will appear here
      </Text>
    </View>
  );
  
  // Header component
  const ListHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.headerTitle}>My Signal History</Text>
          <Text style={styles.headerSubtitle}>
            Showing {historyData.length} of {allData.length} measurement{allData.length !== 1 ? 's' : ''}
          </Text>
        </View>
        
        {/* Filter Toggle */}
        {limit < allData.length && (
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={showAll}
          >
            <MaterialIcons name="filter-list" size={18} color={COLORS.info} />
            <Text style={styles.filterButtonText}>Show All</Text>
          </TouchableOpacity>
        )}
        
        {limit === allData.length && allData.length > 20 && (
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={showLess}
          >
            <MaterialIcons name="filter-list-off" size={18} color={COLORS.textMuted} />
            <Text style={styles.filterButtonText}>Show Less</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Limit Info Badge */}
      <View style={styles.limitBadge}>
        <MaterialIcons name="access-time" size={14} color={COLORS.textMuted} />
        <Text style={styles.limitBadgeText}>
          Last {limit} records {hasMore && `• ${allData.length - limit} more available`}
        </Text>
      </View>
    </View>
  );
  
  // Footer component for "Load More"
  const ListFooter = () => {
    if (!hasMore) return null;
    
    return (
      <TouchableOpacity 
        style={styles.loadMoreButton}
        onPress={loadMore}
      >
        <MaterialIcons name="expand-more" size={24} color={COLORS.info} />
        <Text style={styles.loadMoreText}>Load More (20)</Text>
      </TouchableOpacity>
    );
  };
  
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.info} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <FlatList
        data={historyData}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <SignalHistoryCard item={item} />}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={
          historyData.length === 0 ? styles.emptyListContent : styles.listContent
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
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  
  headerTitle: {
    fontFamily: FONTS.header,
    fontSize: FONT_SIZES.header,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
  },
  
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  
  limitBadgeText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
  },
  
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  loadMoreText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: COLORS.info,
  },
  
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
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
    textAlign: 'center',
  },
});
