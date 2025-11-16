import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from '../modules/auth/screens/LoginScreen';
import { RegisterScreen } from '../modules/auth/screens/RegisterScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Porter Sign In' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Porter Registration' }} />
    </Stack.Navigator>
  );
};
