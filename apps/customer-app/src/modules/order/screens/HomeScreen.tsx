import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

type HomeScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'HomeMain'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const activeOrder = useSelector((state: RootState) => state.order.activeOrder);
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome, {user?.name || 'Customer'}!</Text>

      {activeOrder ? (
        <View style={styles.activeOrderCard}>
          <Text style={styles.cardTitle}>Active Order</Text>
          <Text style={styles.cardText}>Order #{activeOrder.id.slice(0, 8)}</Text>
          <Text style={styles.cardText}>Status: {activeOrder.status}</Text>
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => navigation.navigate('OrderTracking', { orderId: activeOrder.id })}
          >
            <Text style={styles.trackButtonText}>Track Order</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active orders</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateOrder')}
      >
        <Text style={styles.createButtonText}>Create New Order</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  activeOrderCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  trackButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  trackButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  createButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
