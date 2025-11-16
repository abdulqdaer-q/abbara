import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { WalletScreen } from '../modules/wallet/screens/WalletScreen';

export type WalletStackParamList = {
  WalletMain: undefined;
};

const Stack = createStackNavigator<WalletStackParamList>();

export const WalletNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WalletMain" component={WalletScreen} />
    </Stack.Navigator>
  );
};
