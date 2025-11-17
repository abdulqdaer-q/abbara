import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

const mockEarnings = [
  { id: '1', date: '2024-01-15', amount: 50.00, jobId: 'abc123' },
  { id: '2', date: '2024-01-14', amount: 75.00, jobId: 'def456' },
];

export const WalletScreen: React.FC = () => {
  const totalEarnings = mockEarnings.reduce((sum, item) => sum + item.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Earnings</Text>
        <Text style={styles.totalAmount}>${totalEarnings.toFixed(2)}</Text>
      </View>

      <Text style={styles.sectionTitle}>Recent Earnings</Text>
      <FlatList
        data={mockEarnings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.earningCard}>
            <View>
              <Text style={styles.jobId}>Job #{item.jobId}</Text>
              <Text style={styles.date}>{item.date}</Text>
            </View>
            <Text style={styles.amount}>${item.amount.toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  totalCard: { backgroundColor: '#4CAF50', padding: 30, alignItems: 'center', marginBottom: 20 },
  totalLabel: { fontSize: 16, color: '#fff', marginBottom: 10 },
  totalAmount: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 15, marginBottom: 10 },
  earningCard: { backgroundColor: '#fff', padding: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobId: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  date: { fontSize: 12, color: '#666' },
  amount: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
});
