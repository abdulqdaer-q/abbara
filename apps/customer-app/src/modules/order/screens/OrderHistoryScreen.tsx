import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootState } from '../../../store';
import { OrdersStackParamList } from '../../../navigation/OrdersNavigator';

type OrderHistoryScreenNavigationProp = StackNavigationProp<OrdersStackParamList, 'OrderHistory'>;

interface Props {
  navigation: OrderHistoryScreenNavigationProp;
}

export const OrderHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const orders = useSelector((state: RootState) => state.order.orders);

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.orderCard}
            onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
          >
            <Text style={styles.orderId}>Order #{item.id.slice(0, 8)}</Text>
            <Text style={styles.orderStatus}>Status: {item.status}</Text>
            <Text style={styles.orderAddress}>From: {item.pickup.address}</Text>
            <Text style={styles.orderAddress}>To: {item.dropoff.address}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  orderStatus: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 8,
  },
  orderAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
