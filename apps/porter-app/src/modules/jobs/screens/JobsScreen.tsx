import React from 'react';
import { View, Text, Switch, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootState } from '../../../store';
import { setOnline } from '../../../store/slices/availabilitySlice';
import { JobsStackParamList } from '../../../navigation/JobsNavigator';

type JobsScreenNavigationProp = StackNavigationProp<JobsStackParamList, 'JobsList'>;

interface Props {
  navigation: JobsScreenNavigationProp;
}

export const JobsScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const { isOnline } = useSelector((state: RootState) => state.availability);
  const { activeJob, jobRequests } = useSelector((state: RootState) => state.job);

  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
          <Switch value={isOnline} onValueChange={(value) => dispatch(setOnline(value))} />
        </View>
      </View>

      {activeJob && (
        <TouchableOpacity
          style={styles.activeJobCard}
          onPress={() => navigation.navigate('JobDetails', { jobId: activeJob.id })}
        >
          <Text style={styles.cardTitle}>Active Job</Text>
          <Text style={styles.cardText}>Order #{activeJob.id.slice(0, 8)}</Text>
          <Text style={styles.cardText}>Status: {activeJob.status}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Available Jobs</Text>
      <FlatList
        data={jobRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.jobCard}
            onPress={() => navigation.navigate('JobDetails', { jobId: item.id })}
          >
            <Text style={styles.jobId}>Order #{item.id.slice(0, 8)}</Text>
            <Text style={styles.jobText}>From: {item.pickup.address}</Text>
            <Text style={styles.jobText}>To: {item.dropoff.address}</Text>
            <Text style={styles.jobPrice}>${(item.priceCents / 100).toFixed(2)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {isOnline ? 'No jobs available' : 'Go online to receive jobs'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  statusCard: { backgroundColor: '#fff', padding: 20, marginBottom: 15 },
  statusLabel: { fontSize: 16, color: '#666', marginBottom: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText: { fontSize: 20, fontWeight: 'bold' },
  activeJobCard: { backgroundColor: '#4CAF50', padding: 20, marginHorizontal: 15, marginBottom: 15, borderRadius: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  cardText: { fontSize: 14, color: '#fff', marginBottom: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 15, marginBottom: 10 },
  jobCard: { backgroundColor: '#fff', padding: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 8 },
  jobId: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  jobText: { fontSize: 12, color: '#666', marginBottom: 3 },
  jobPrice: { fontSize: 18, fontWeight: 'bold', color: '#4CAF50', marginTop: 5 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
});
