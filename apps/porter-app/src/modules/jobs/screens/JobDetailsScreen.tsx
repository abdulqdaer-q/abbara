import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { JobsStackParamList } from '../../../navigation/JobsNavigator';

type JobDetailsScreenRouteProp = RouteProp<JobsStackParamList, 'JobDetails'>;

interface Props {
  route: JobDetailsScreenRouteProp;
}

export const JobDetailsScreen: React.FC<Props> = ({ route }) => {
  const { jobId } = route.params;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Job Details</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Order ID</Text>
        <Text style={styles.value}>{jobId}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>123 Main St, City</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Dropoff</Text>
        <Text style={styles.value}>456 Oak Ave, City</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Earnings</Text>
        <Text style={styles.value}>$50.00</Text>
      </View>
      <TouchableOpacity style={styles.acceptButton}>
        <Text style={styles.acceptButtonText}>Accept Job</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  section: { marginBottom: 15 },
  label: { fontSize: 14, color: '#666', marginBottom: 5 },
  value: { fontSize: 16, color: '#333', fontWeight: '600' },
  acceptButton: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 30 },
  acceptButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
