import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { OrderHistoryScreen } from '../modules/order/screens/OrderHistoryScreen';
import { OrderDetailsScreen } from '../modules/order/screens/OrderDetailsScreen';
import { RateOrderScreen } from '../modules/ratings/screens/RateOrderScreen';

export type OrdersStackParamList = {
  OrderHistory: undefined;
  OrderDetails: { orderId: string };
  RateOrder: { orderId: string; porterId: string };
};

const Stack = createStackNavigator<OrdersStackParamList>();

export const OrdersNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
      <Stack.Screen name="RateOrder" component={RateOrderScreen} />
    </Stack.Navigator>
  );
};
