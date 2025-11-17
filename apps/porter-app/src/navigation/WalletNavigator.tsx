import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { EnhancedWalletScreen } from '../modules/wallet/screens/EnhancedWalletScreen';

export type WalletStackParamList = {
  WalletMain: undefined;
};

const Stack = createStackNavigator<WalletStackParamList>();

export const WalletNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WalletMain" component={EnhancedWalletScreen} />
    </Stack.Navigator>
  );
};
