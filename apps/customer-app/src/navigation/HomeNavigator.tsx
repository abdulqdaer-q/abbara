import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { HomeScreen } from '../modules/order/screens/HomeScreen';
import { CreateOrderScreen } from '../modules/order/screens/CreateOrderScreen';
import { OrderTrackingScreen } from '../modules/order/screens/OrderTrackingScreen';
import { ChatScreen } from '../modules/chat/screens/ChatScreen';

export type HomeStackParamList = {
  HomeMain: undefined;
  CreateOrder: undefined;
  OrderTracking: { orderId: string };
  Chat: { orderId: string; porterId: string };
};

const Stack = createStackNavigator<HomeStackParamList>();

export const HomeNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: 'MoveNow' }}
      />
      <Stack.Screen
        name="CreateOrder"
        component={CreateOrderScreen}
        options={{ title: 'New Order' }}
      />
      <Stack.Screen
        name="OrderTracking"
        component={OrderTrackingScreen}
        options={{ title: 'Track Order' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat with Porter' }}
      />
    </Stack.Navigator>
  );
};
