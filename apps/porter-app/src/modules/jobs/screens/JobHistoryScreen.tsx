import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { JobsStackParamList } from '../../../navigation/JobsNavigator';

type JobHistoryScreenNavigationProp = StackNavigationProp<JobsStackParamList, 'JobHistory'>;

interface Props {
  navigation: JobHistoryScreenNavigationProp;
}

interface JobHistory {
  id: string;
  orderId: string;
  pickup: string;
  dropoff: string;
  completedAt: string;
  earnings: number;
  rating?: number;
  status: 'completed' | 'cancelled';
  customerName: string;
  distance: number;
  duration: number;
}

// Mock data
const mockJobHistory: JobHistory[] = [
  {
    id: '1',
    orderId: 'ORD-001',
    pickup: '123 Main St, Downtown',
    dropoff: '456 Oak Ave, Uptown',
    completedAt: '2024-01-15 14:30',
    earnings: 52.50,
    rating: 5,
    status: 'completed',
    customerName: 'John Doe',
    distance: 8.5,
    duration: 35,
  },
  {
    id: '2',
    orderId: 'ORD-002',
    pickup: '789 Elm St, Midtown',
    dropoff: '321 Pine Rd, Eastside',
    completedAt: '2024-01-14 10:15',
    earnings: 75.00,
    rating: 4,
    status: 'completed',
    customerName: 'Jane Smith',
    distance: 12.3,
    duration: 48,
  },
  {
    id: '3',
    orderId: 'ORD-003',
    pickup: '555 Maple Dr, Westend',
    dropoff: '888 Cedar Ln, Northside',
    completedAt: '2024-01-13 16:45',
    earnings: 0,
    status: 'cancelled',
    customerName: 'Bob Johnson',
    distance: 5.2,
    duration: 0,
  },
  {
    id: '4',
    orderId: 'ORD-004',
    pickup: '111 Birch St, Central',
    dropoff: '222 Willow Way, Southend',
    completedAt: '2024-01-12 09:20',
    earnings: 45.00,
    rating: 5,
    status: 'completed',
    customerName: 'Alice Brown',
    distance: 6.8,
    duration: 28,
  },
];

export const JobHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const [jobs, setJobs] = useState<JobHistory[]>(mockJobHistory);
  const [filteredJobs, setFilteredJobs] = useState<JobHistory[]>(mockJobHistory);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(query, filter);
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    applyFilters(searchQuery, newFilter);
  };

  const applyFilters = (search: string, statusFilter: typeof filter) => {
    let filtered = jobs;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    // Apply search
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        job =>
          job.orderId.toLowerCase().includes(lowerSearch) ||
          job.pickup.toLowerCase().includes(lowerSearch) ||
          job.dropoff.toLowerCase().includes(lowerSearch) ||
          job.customerName.toLowerCase().includes(lowerSearch)
      );
    }

    setFilteredJobs(filtered);
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map(star => (
          <Text key={star} style={styles.star}>
            {star <= rating ? '⭐' : '☆'}
          </Text>
        ))}
      </View>
    );
  };

  const renderJob = ({ item }: { item: JobHistory }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => {
        // Navigate to job details if needed
      }}
    >
      <View style={styles.jobHeader}>
        <View>
          <Text style={styles.orderId}>{item.orderId}</Text>
          <Text style={styles.date}>{item.completedAt}</Text>
        </View>
        <View style={styles.statusBadgeContainer}>
          <View
            style={[
              styles.statusBadge,
              item.status === 'completed' ? styles.statusCompleted : styles.statusCancelled,
            ]}
          >
            <Text style={styles.statusText}>
              {item.status === 'completed' ? '✓ Completed' : '✕ Cancelled'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.customerRow}>
        <Text style={styles.customerIcon}>👤</Text>
        <Text style={styles.customerName}>{item.customerName}</Text>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickup}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <Text style={styles.locationIcon}>🎯</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoff}
          </Text>
        </View>
      </View>

      <View style={styles.jobFooter}>
        <View style={styles.jobStats}>
          <Text style={styles.statText}>
            📏 {item.distance} mi • ⏱️ {item.duration} min
          </Text>
        </View>
        <View style={styles.earningsContainer}>
          <Text style={styles.earnings}>
            {item.status === 'completed' ? `$${item.earnings.toFixed(2)}` : 'No charge'}
          </Text>
        </View>
      </View>

      {item.rating && (
        <View style={styles.ratingContainer}>{renderStars(item.rating)}</View>
      )}
    </TouchableOpacity>
  );

  const totalEarnings = jobs
    .filter(j => j.status === 'completed')
    .reduce((sum, job) => sum + job.earnings, 0);
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const cancelledCount = jobs.filter(j => j.status === 'cancelled').length;

  return (
    <View style={styles.container}>
      {/* Stats Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Jobs</Text>
          <Text style={styles.summaryValue}>{jobs.length}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Completed</Text>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{completedCount}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Earned</Text>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
            ${totalEarnings.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by order ID, location, or customer..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({jobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Completed ({completedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'cancelled' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('cancelled')}
        >
          <Text style={[styles.filterText, filter === 'cancelled' && styles.filterTextActive]}>
            Cancelled ({cancelledCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Jobs List */}
      <FlatList
        data={filteredJobs}
        keyExtractor={item => item.id}
        renderItem={renderJob}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No jobs found</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  summaryDivider: { width: 1, backgroundColor: '#e0e0e0', marginHorizontal: 10 },
  searchContainer: { paddingHorizontal: 15, marginBottom: 15 },
  searchInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 15, gap: 8 },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filterButtonActive: { backgroundColor: '#4CAF50' },
  filterText: { fontSize: 13, color: '#666' },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },
  listContent: { paddingBottom: 20 },
  jobCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 12,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  date: { fontSize: 11, color: '#999', marginTop: 2 },
  statusBadgeContainer: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusCompleted: { backgroundColor: '#E8F5E9' },
  statusCancelled: { backgroundColor: '#FFEBEE' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerIcon: { fontSize: 14, marginRight: 6 },
  customerName: { fontSize: 14, color: '#666' },
  locationContainer: { marginBottom: 10 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationIcon: { fontSize: 14, marginRight: 8, width: 20 },
  locationText: { fontSize: 13, color: '#333', flex: 1 },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  jobStats: { flex: 1 },
  statText: { fontSize: 11, color: '#666' },
  earningsContainer: { alignItems: 'flex-end' },
  earnings: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50' },
  ratingContainer: { marginTop: 8 },
  starsContainer: { flexDirection: 'row' },
  star: { fontSize: 12, marginRight: 2 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
});
