import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { JobsScreen } from '../modules/jobs/screens/JobsScreen';
import { JobDetailsScreen } from '../modules/jobs/screens/JobDetailsScreen';
import { NavigationScreen } from '../modules/map/screens/NavigationScreen';
import { ChatScreen } from '../modules/chat/screens/ChatScreen';

export type JobsStackParamList = {
  JobsList: undefined;
  JobDetails: { jobId: string };
  Navigation: { jobId: string };
  Chat: { orderId: string; customerId: string };
};

const Stack = createStackNavigator<JobsStackParamList>();

export const JobsNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="JobsList" component={JobsScreen} options={{ title: 'Available Jobs' }} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
      <Stack.Screen name="Navigation" component={NavigationScreen} options={{ title: 'Navigate' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat with Customer' }} />
    </Stack.Navigator>
  );
};
