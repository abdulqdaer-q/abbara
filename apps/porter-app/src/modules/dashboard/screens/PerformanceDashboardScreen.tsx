import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';

const { width } = Dimensions.get('window');

interface EarningsData {
  day: string;
  amount: number;
}

interface PerformanceStats {
  totalJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  averageRating: number;
  totalRatings: number;
  totalEarnings: number;
  thisWeekEarnings: number;
  thisMonthEarnings: number;
  averageJobValue: number;
  onTimePercentage: number;
  acceptanceRate: number;
  hoursOnline: number;
}

// Mock data
const mockStats: PerformanceStats = {
  totalJobs: 247,
  completedJobs: 235,
  cancelledJobs: 12,
  averageRating: 4.8,
  totalRatings: 198,
  totalEarnings: 12450.00,
  thisWeekEarnings: 875.50,
  thisMonthEarnings: 3250.00,
  averageJobValue: 52.00,
  onTimePercentage: 96,
  acceptanceRate: 92,
  hoursOnline: 156,
};

const mockWeeklyEarnings: EarningsData[] = [
  { day: 'Mon', amount: 125 },
  { day: 'Tue', amount: 180 },
  { day: 'Wed', amount: 150 },
  { day: 'Thu', amount: 220 },
  { day: 'Fri', amount: 200 },
  { day: 'Sat', amount: 0 },
  { day: 'Sun', amount: 0 },
];

export const PerformanceDashboardScreen: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats>(mockStats);
  const [weeklyEarnings, setWeeklyEarnings] = useState<EarningsData[]>(mockWeeklyEarnings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const maxEarning = Math.max(...weeklyEarnings.map(e => e.amount));

  const renderBarChart = () => {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weekly Earnings</Text>
        <View style={styles.chart}>
          {weeklyEarnings.map((data, index) => {
            const barHeight = maxEarning > 0 ? (data.amount / maxEarning) * 120 : 0;
            return (
              <View key={index} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  {data.amount > 0 && (
                    <Text style={styles.barValue}>${data.amount}</Text>
                  )}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight || 5,
                        backgroundColor: data.amount > 0 ? '#4CAF50' : '#e0e0e0',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{data.day}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      {/* Earnings Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Earnings Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>This Week</Text>
            <Text style={styles.summaryValue}>${stats.thisWeekEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>This Month</Text>
            <Text style={styles.summaryValue}>${stats.thisMonthEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
            <Text style={styles.summaryValue}>${stats.totalEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avg per Job</Text>
            <Text style={styles.summaryValue}>${stats.averageJobValue.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Chart */}
      {renderBarChart()}

      {/* Performance Metrics */}
      <View style={styles.metricsCard}>
        <Text style={styles.cardTitle}>Performance Metrics</Text>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Rating</Text>
              <Text style={styles.metricIcon}>⭐</Text>
            </View>
            <Text style={styles.metricValue}>{stats.averageRating.toFixed(1)}</Text>
            <Text style={styles.metricSubtext}>from {stats.totalRatings} reviews</Text>
          </View>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Jobs Completed</Text>
              <Text style={styles.metricIcon}>✓</Text>
            </View>
            <Text style={styles.metricValue}>{stats.completedJobs}</Text>
            <Text style={styles.metricSubtext}>of {stats.totalJobs} total</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>On-Time %</Text>
              <Text style={styles.metricIcon}>⏱️</Text>
            </View>
            <Text style={styles.metricValue}>{stats.onTimePercentage}%</Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${stats.onTimePercentage}%` }]}
              />
            </View>
          </View>

          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>Acceptance Rate</Text>
              <Text style={styles.metricIcon}>📊</Text>
            </View>
            <Text style={styles.metricValue}>{stats.acceptanceRate}%</Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${stats.acceptanceRate}%` }]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Activity Summary */}
      <View style={styles.activityCard}>
        <Text style={styles.cardTitle}>Activity Summary</Text>

        <View style={styles.activityItem}>
          <View style={styles.activityLeft}>
            <Text style={styles.activityIcon}>🚗</Text>
            <Text style={styles.activityLabel}>Hours Online</Text>
          </View>
          <Text style={styles.activityValue}>{stats.hoursOnline} hrs</Text>
        </View>

        <View style={styles.activityItem}>
          <View style={styles.activityLeft}>
            <Text style={styles.activityIcon}>✅</Text>
            <Text style={styles.activityLabel}>Completed Jobs</Text>
          </View>
          <Text style={styles.activityValue}>{stats.completedJobs}</Text>
        </View>

        <View style={styles.activityItem}>
          <View style={styles.activityLeft}>
            <Text style={styles.activityIcon}>❌</Text>
            <Text style={styles.activityLabel}>Cancelled Jobs</Text>
          </View>
          <Text style={styles.activityValue}>{stats.cancelledJobs}</Text>
        </View>

        <View style={styles.activityItem}>
          <View style={styles.activityLeft}>
            <Text style={styles.activityIcon}>💵</Text>
            <Text style={styles.activityLabel}>Earnings per Hour</Text>
          </View>
          <Text style={styles.activityValue}>
            ${(stats.totalEarnings / stats.hoursOnline).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Achievements */}
      <View style={styles.achievementsCard}>
        <Text style={styles.cardTitle}>Achievements</Text>
        <View style={styles.achievementsList}>
          <View style={styles.achievementBadge}>
            <Text style={styles.achievementIcon}>🏆</Text>
            <Text style={styles.achievementText}>Top Rated</Text>
          </View>
          <View style={styles.achievementBadge}>
            <Text style={styles.achievementIcon}>⚡</Text>
            <Text style={styles.achievementText}>Fast Response</Text>
          </View>
          <View style={styles.achievementBadge}>
            <Text style={styles.achievementIcon}>💯</Text>
            <Text style={styles.achievementText}>100 Jobs</Text>
          </View>
        </View>
      </View>

      {/* Tips */}
      <View style={styles.tipsCard}>
        <Text style={styles.cardTitle}>💡 Tips to Improve</Text>
        <Text style={styles.tipText}>• Maintain high acceptance rate to get priority job offers</Text>
        <Text style={styles.tipText}>• Keep your average rating above 4.5 for bonus eligibility</Text>
        <Text style={styles.tipText}>• Complete jobs on time to improve your on-time percentage</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  summaryCard: { backgroundColor: '#4CAF50', padding: 20, marginBottom: 15 },
  summaryTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  summaryItem: { width: (width - 40 - 15) / 2, backgroundColor: 'rgba(255,255,255,0.2)', padding: 15, borderRadius: 8 },
  summaryLabel: { fontSize: 12, color: '#fff', marginBottom: 5, opacity: 0.9 },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  chartContainer: { backgroundColor: '#fff', padding: 20, marginBottom: 15 },
  chartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160 },
  barContainer: { flex: 1, alignItems: 'center' },
  barWrapper: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  bar: { width: 30, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barValue: { fontSize: 10, fontWeight: 'bold', marginBottom: 5, color: '#4CAF50' },
  barLabel: { fontSize: 11, marginTop: 5, color: '#666' },
  metricsCard: { backgroundColor: '#fff', padding: 20, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  metricRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  metricItem: { flex: 1, backgroundColor: '#f5f5f5', padding: 15, borderRadius: 8 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metricLabel: { fontSize: 12, color: '#666' },
  metricIcon: { fontSize: 16 },
  metricValue: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  metricSubtext: { fontSize: 11, color: '#999' },
  progressBar: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  activityCard: { backgroundColor: '#fff', padding: 20, marginBottom: 15 },
  activityItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  activityLeft: { flexDirection: 'row', alignItems: 'center' },
  activityIcon: { fontSize: 20, marginRight: 12 },
  activityLabel: { fontSize: 14, color: '#333' },
  activityValue: { fontSize: 16, fontWeight: 'bold', color: '#4CAF50' },
  achievementsCard: { backgroundColor: '#fff', padding: 20, marginBottom: 15 },
  achievementsList: { flexDirection: 'row', gap: 10 },
  achievementBadge: { flex: 1, backgroundColor: '#FFF9C4', padding: 15, borderRadius: 8, alignItems: 'center' },
  achievementIcon: { fontSize: 32, marginBottom: 5 },
  achievementText: { fontSize: 11, fontWeight: 'bold', color: '#F57F17', textAlign: 'center' },
  tipsCard: { backgroundColor: '#E3F2FD', padding: 20, marginBottom: 20 },
  tipText: { fontSize: 13, color: '#1976D2', marginBottom: 8, lineHeight: 20 },
});
