import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { JobsNavigator } from './JobsNavigator';
import { WalletNavigator } from './WalletNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { PerformanceDashboardScreen } from '../modules/dashboard/screens/PerformanceDashboardScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Jobs: undefined;
  Wallet: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Jobs') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'Wallet') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Dashboard" component={PerformanceDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Jobs" component={JobsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Wallet" component={WalletNavigator} options={{ title: 'Earnings' }} />
      <Tab.Screen name="Profile" component={ProfileNavigator} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
};
