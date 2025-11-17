import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { OrdersStackParamList } from '../../../navigation/OrdersNavigator';

type OrderDetailsScreenRouteProp = RouteProp<OrdersStackParamList, 'OrderDetails'>;

interface Props {
  route: OrderDetailsScreenRouteProp;
}

export const OrderDetailsScreen: React.FC<Props> = ({ route }) => {
  const { orderId } = route.params;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Order Details</Text>
      <Text style={styles.text}>Order ID: {orderId}</Text>
      <Text style={styles.text}>Status: Completed</Text>
      <Text style={styles.text}>Vehicle Type: Van</Text>
      <Text style={styles.text}>Porter Count: 2</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    marginBottom: 10,
    color: '#666',
  },
});
