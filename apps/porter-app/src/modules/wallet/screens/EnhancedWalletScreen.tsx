import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  jobId: string;
  type: 'earning' | 'withdrawal' | 'bonus' | 'penalty';
  status: 'completed' | 'pending' | 'failed';
  description?: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  accountNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  processedAt?: string;
}

// Mock data - will be replaced with API calls
const mockTransactions: Transaction[] = [
  { id: '1', date: '2024-01-15', amount: 50.00, jobId: 'abc123', type: 'earning', status: 'completed' },
  { id: '2', date: '2024-01-14', amount: 75.00, jobId: 'def456', type: 'earning', status: 'completed' },
  { id: '3', date: '2024-01-13', amount: -100.00, jobId: '', type: 'withdrawal', status: 'completed', description: 'Withdrawal to bank' },
  { id: '4', date: '2024-01-12', amount: 20.00, jobId: '', type: 'bonus', status: 'completed', description: 'Completion bonus' },
];

export const EnhancedWalletScreen: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [filter, setFilter] = useState<'all' | 'earning' | 'withdrawal'>('all');
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate totals
  const totalEarnings = transactions
    .filter(t => t.type === 'earning' && t.status === 'completed')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalWithdrawals = Math.abs(
    transactions
      .filter(t => t.type === 'withdrawal' && t.status === 'completed')
      .reduce((sum, item) => sum + item.amount, 0)
  );

  const availableBalance = totalEarnings - totalWithdrawals;

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  const handleWithdrawal = async () => {
    const amount = parseFloat(withdrawalAmount);

    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amount > availableBalance) {
      Alert.alert('Insufficient Balance', 'You do not have enough balance for this withdrawal');
      return;
    }

    if (!bankAccount || bankAccount.length < 10) {
      Alert.alert('Invalid Account', 'Please enter a valid bank account number');
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        amount: -amount,
        jobId: '',
        type: 'withdrawal',
        status: 'pending',
        description: `Withdrawal to ${bankAccount.slice(-4).padStart(bankAccount.length, '*')}`,
      };

      setTransactions([newTransaction, ...transactions]);
      setShowWithdrawalModal(false);
      setWithdrawalAmount('');
      setBankAccount('');
      setIsLoading(false);

      Alert.alert(
        'Withdrawal Requested',
        'Your withdrawal request has been submitted and will be processed within 1-3 business days.'
      );
    }, 1500);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'earning': return '💰';
      case 'withdrawal': return '🏦';
      case 'bonus': return '🎁';
      case 'penalty': return '⚠️';
      default: return '📝';
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'failed': return '#f44336';
      default: return '#666';
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionLeft}>
        <Text style={styles.transactionIcon}>{getTransactionIcon(item.type)}</Text>
        <View>
          <Text style={styles.transactionType}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </Text>
          {item.jobId && <Text style={styles.jobId}>Job #{item.jobId}</Text>}
          {item.description && <Text style={styles.description}>{item.description}</Text>}
          <Text style={styles.date}>{item.date}</Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.amount, { color: item.amount >= 0 ? '#4CAF50' : '#f44336' }]}>
          {item.amount >= 0 ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
          {item.status}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>${availableBalance.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={() => setShowWithdrawalModal(true)}
            disabled={availableBalance <= 0}
          >
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Earnings</Text>
            <Text style={styles.statValue}>${totalEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Withdrawn</Text>
            <Text style={styles.statValue}>${totalWithdrawals.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'earning' && styles.filterButtonActive]}
          onPress={() => setFilter('earning')}
        >
          <Text style={[styles.filterText, filter === 'earning' && styles.filterTextActive]}>
            Earnings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'withdrawal' && styles.filterButtonActive]}
          onPress={() => setFilter('withdrawal')}
        >
          <Text style={[styles.filterText, filter === 'withdrawal' && styles.filterTextActive]}>
            Withdrawals
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      <Text style={styles.sectionTitle}>Transaction History</Text>
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
      />

      {/* Withdrawal Modal */}
      <Modal
        visible={showWithdrawalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdrawalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Withdrawal</Text>

            <View style={styles.availableBalanceInfo}>
              <Text style={styles.availableBalanceLabel}>Available Balance</Text>
              <Text style={styles.availableBalanceAmount}>${availableBalance.toFixed(2)}</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Withdrawal Amount"
              keyboardType="numeric"
              value={withdrawalAmount}
              onChangeText={setWithdrawalAmount}
            />

            <TextInput
              style={styles.input}
              placeholder="Bank Account Number"
              keyboardType="number-pad"
              value={bankAccount}
              onChangeText={setBankAccount}
            />

            <Text style={styles.modalInfo}>
              Processing time: 1-3 business days{'\n'}
              Minimum withdrawal: $10.00
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowWithdrawalModal(false)}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleWithdrawal}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  balanceCard: { backgroundColor: '#4CAF50', padding: 20, marginBottom: 15 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  balanceItem: { flex: 1 },
  balanceLabel: { fontSize: 14, color: '#fff', marginBottom: 5, opacity: 0.9 },
  balanceAmount: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  withdrawButton: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  withdrawButtonText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { flex: 1 },
  statLabel: { fontSize: 12, color: '#fff', marginBottom: 5, opacity: 0.8 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 15, gap: 10 },
  filterButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center' },
  filterButtonActive: { backgroundColor: '#4CAF50' },
  filterText: { fontSize: 14, color: '#666' },
  filterTextActive: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 15, marginBottom: 10 },
  transactionCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  transactionIcon: { fontSize: 24, marginRight: 12 },
  transactionType: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  jobId: { fontSize: 12, color: '#666', marginBottom: 2 },
  description: { fontSize: 12, color: '#666', marginBottom: 2 },
  date: { fontSize: 11, color: '#999' },
  transactionRight: { alignItems: 'flex-end' },
  amount: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  status: { fontSize: 11, textTransform: 'capitalize' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  availableBalanceInfo: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 8, marginBottom: 20, alignItems: 'center' },
  availableBalanceLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  availableBalanceAmount: { fontSize: 28, fontWeight: 'bold', color: '#4CAF50' },
  input: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 8, fontSize: 16, marginBottom: 15 },
  modalInfo: { fontSize: 12, color: '#666', marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f5f5f5' },
  cancelButtonText: { fontSize: 16, color: '#666', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#4CAF50' },
  submitButtonText: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
});
