import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { trpc, trpcClient } from './src/services/trpc';
import { useAuthStore } from './src/store/useAuthStore';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { MainNavigator } from './src/navigation/MainNavigator';
import { notificationService } from './src/services/notification.service';
import { theme } from './src/utils/theme';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const { isAuthenticated, refreshAuth } = useAuthStore();

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize authentication state
        await refreshAuth();

        // Request notification permissions
        await notificationService.requestPermissions();
        await notificationService.getPushToken();

        // App is ready
        setIsAppReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsAppReady(true); // Still show app even if initialization fails
      }
    }

    initialize();
  }, []);

  // Setup notification listeners
  useEffect(() => {
    // Listen for foreground notifications
    const notificationListener = notificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    // Listen for notification taps
    const responseListener = notificationService.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification tapped:', response);
        // TODO: Handle navigation based on notification data
      }
    );

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  if (!isAppReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <PaperProvider theme={theme}>
              <NavigationContainer>
                <StatusBar style="auto" />
                {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
              </NavigationContainer>
            </PaperProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
