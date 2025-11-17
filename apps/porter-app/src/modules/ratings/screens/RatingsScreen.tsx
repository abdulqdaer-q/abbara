import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';

interface Rating {
  id: string;
  customerName: string;
  orderId: string;
  rating: number;
  review?: string;
  date: string;
  jobType: string;
}

// Mock data
const mockRatings: Rating[] = [
  {
    id: '1',
    customerName: 'John Doe',
    orderId: 'ORD-001',
    rating: 5,
    review: 'Excellent service! Very professional and careful with my items.',
    date: '2024-01-15',
    jobType: 'Furniture Moving',
  },
  {
    id: '2',
    customerName: 'Jane Smith',
    orderId: 'ORD-002',
    rating: 4,
    review: 'Good service, arrived on time.',
    date: '2024-01-14',
    jobType: 'Apartment Move',
  },
  {
    id: '3',
    customerName: 'Bob Johnson',
    orderId: 'ORD-003',
    rating: 5,
    review: 'Amazing! Would definitely hire again. Very quick and efficient.',
    date: '2024-01-13',
    jobType: 'Office Move',
  },
  {
    id: '4',
    customerName: 'Alice Brown',
    orderId: 'ORD-004',
    rating: 5,
    date: '2024-01-12',
    jobType: 'Small Item Delivery',
  },
  {
    id: '5',
    customerName: 'Charlie Wilson',
    orderId: 'ORD-005',
    rating: 3,
    review: 'Service was okay, but took longer than expected.',
    date: '2024-01-11',
    jobType: 'House Move',
  },
];

export const RatingsScreen: React.FC = () => {
  const [ratings, setRatings] = useState<Rating[]>(mockRatings);
  const [filter, setFilter] = useState<'all' | 5 | 4 | 3 | 2 | 1>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Calculate statistics
  const totalRatings = ratings.length;
  const averageRating =
    ratings.reduce((sum, r) => sum + r.rating, 0) / (totalRatings || 1);

  const ratingCounts = {
    5: ratings.filter(r => r.rating === 5).length,
    4: ratings.filter(r => r.rating === 4).length,
    3: ratings.filter(r => r.rating === 3).length,
    2: ratings.filter(r => r.rating === 2).length,
    1: ratings.filter(r => r.rating === 1).length,
  };

  const filteredRatings =
    filter === 'all' ? ratings : ratings.filter(r => r.rating === filter);

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map(star => (
          <Text key={star} style={[styles.star, { fontSize: size }]}>
            {star <= rating ? '⭐' : '☆'}
          </Text>
        ))}
      </View>
    );
  };

  const renderRatingBar = (starCount: 5 | 4 | 3 | 2 | 1) => {
    const count = ratingCounts[starCount];
    const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;

    return (
      <TouchableOpacity
        key={starCount}
        style={styles.ratingBarContainer}
        onPress={() => setFilter(filter === starCount ? 'all' : starCount)}
      >
        <Text style={styles.ratingBarLabel}>{starCount} ⭐</Text>
        <View style={styles.ratingBar}>
          <View style={[styles.ratingBarFill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.ratingBarCount}>{count}</Text>
      </TouchableOpacity>
    );
  };

  const renderRating = ({ item }: { item: Rating }) => (
    <View style={styles.ratingCard}>
      <View style={styles.ratingHeader}>
        <View>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.orderId}>Order #{item.orderId}</Text>
        </View>
        <View style={styles.ratingRight}>
          {renderStars(item.rating, 14)}
          <Text style={styles.date}>{item.date}</Text>
        </View>
      </View>

      <Text style={styles.jobType}>📦 {item.jobType}</Text>

      {item.review && (
        <View style={styles.reviewContainer}>
          <Text style={styles.reviewText}>"{item.review}"</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.averageRatingContainer}>
          <Text style={styles.averageRatingNumber}>{averageRating.toFixed(1)}</Text>
          {renderStars(Math.round(averageRating), 20)}
          <Text style={styles.totalRatingsText}>{totalRatings} ratings</Text>
        </View>

        <View style={styles.ratingBarsContainer}>
          {[5, 4, 3, 2, 1].map(star => renderRatingBar(star as 5 | 4 | 3 | 2 | 1))}
        </View>
      </View>

      {/* Filter Info */}
      {filter !== 'all' && (
        <View style={styles.filterInfo}>
          <Text style={styles.filterInfoText}>
            Showing {filteredRatings.length} {filter}-star rating
            {filteredRatings.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity onPress={() => setFilter('all')}>
            <Text style={styles.clearFilterText}>Clear filter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ratings List */}
      <FlatList
        data={filteredRatings}
        keyExtractor={item => item.id}
        renderItem={renderRating}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No ratings yet</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  summaryCard: { backgroundColor: '#fff', padding: 20, marginBottom: 15 },
  averageRatingContainer: { alignItems: 'center', marginBottom: 20 },
  averageRatingNumber: { fontSize: 56, fontWeight: 'bold', color: '#4CAF50' },
  starsContainer: { flexDirection: 'row', marginVertical: 8 },
  star: { marginHorizontal: 2 },
  totalRatingsText: { fontSize: 14, color: '#666', marginTop: 5 },
  ratingBarsContainer: { gap: 8 },
  ratingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratingBarLabel: { fontSize: 13, width: 40 },
  ratingBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBarFill: { height: '100%', backgroundColor: '#4CAF50' },
  ratingBarCount: { fontSize: 13, color: '#666', width: 30, textAlign: 'right' },
  filterInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#E8F5E9',
    marginBottom: 10,
  },
  filterInfoText: { fontSize: 14, color: '#2E7D32' },
  clearFilterText: { fontSize: 14, color: '#4CAF50', fontWeight: 'bold' },
  listContent: { paddingBottom: 20 },
  ratingCard: {
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
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  customerName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  orderId: { fontSize: 12, color: '#999', marginTop: 2 },
  ratingRight: { alignItems: 'flex-end' },
  date: { fontSize: 11, color: '#999', marginTop: 4 },
  jobType: { fontSize: 13, color: '#666', marginBottom: 10 },
  reviewContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  reviewText: { fontSize: 14, color: '#333', lineHeight: 20, fontStyle: 'italic' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
});
