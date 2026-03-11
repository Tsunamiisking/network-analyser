import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import SignalHistoryCard from '../../components/SignalHistoryCard';
import { MOCK_SIGNAL_HISTORY } from '../../constants/mockData';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../constants/theme';

export default function History() {
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Using mock data - will replace with API call later
  const historyData = MOCK_SIGNAL_HISTORY.data;
  
  // Simulated refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Replace with actual API call
    // await fetchSignalHistory();
    setTimeout(() => setRefreshing(false), 1000);
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
      <Text style={styles.headerTitle}>My Signal History</Text>
      <Text style={styles.headerSubtitle}>
        {historyData.length} measurement{historyData.length !== 1 ? 's' : ''}
      </Text>
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
    <View style={styles.container}>
      <FlatList
        data={historyData}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <SignalHistoryCard item={item} />}
        ListHeaderComponent={ListHeader}
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