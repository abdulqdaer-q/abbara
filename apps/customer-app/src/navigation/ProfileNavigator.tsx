import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { ProfileScreen } from '../modules/profile/screens/ProfileScreen';
import { EditProfileScreen } from '../modules/profile/screens/EditProfileScreen';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
};

const Stack = createStackNavigator<ProfileStackParamList>();

export const ProfileNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
    </Stack.Navigator>
  );
};
