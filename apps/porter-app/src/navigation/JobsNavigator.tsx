import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JobsScreen } from '../modules/jobs/screens/JobsScreen';
import { JobDetailsScreen } from '../modules/jobs/screens/JobDetailsScreen';
import { JobHistoryScreen } from '../modules/jobs/screens/JobHistoryScreen';
import { NavigationScreen } from '../modules/map/screens/NavigationScreen';
import { ChatScreen } from '../modules/chat/screens/ChatScreen';

export type JobsStackParamList = {
  JobsList: undefined;
  JobHistory: undefined;
  JobDetails: { jobId: string };
  Navigation: { jobId: string };
  Chat: { orderId: string; customerId: string };
};

const Stack = createStackNavigator<JobsStackParamList>();

export const JobsNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="JobsList"
        component={JobsScreen}
        options={({ navigation }) => ({
          title: 'Available Jobs',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('JobHistory')}
              style={{ marginRight: 15 }}
            >
              <Ionicons name="time-outline" size={24} color="#4CAF50" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="JobHistory" component={JobHistoryScreen} options={{ title: 'Job History' }} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
      <Stack.Screen name="Navigation" component={NavigationScreen} options={{ title: 'Navigate' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat with Customer' }} />
    </Stack.Navigator>
  );
};
