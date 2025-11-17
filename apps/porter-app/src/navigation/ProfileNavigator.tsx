import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ProfileScreen } from '../modules/profile/screens/ProfileScreen';
import { EditProfileScreen } from '../modules/profile/screens/EditProfileScreen';
import { VerificationScreen } from '../modules/profile/screens/VerificationScreen';
import { RatingsScreen } from '../modules/ratings/screens/RatingsScreen';
import { SettingsScreen } from '../modules/settings/screens/SettingsScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Verification: undefined;
  Ratings: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<ProfileStackParamList>();

export const ProfileNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Verification" component={VerificationScreen} options={{ title: 'Verification' }} />
      <Stack.Screen name="Ratings" component={RatingsScreen} options={{ title: 'Ratings & Reviews' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
};
