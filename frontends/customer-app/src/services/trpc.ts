import { createTRPCReact } from '@trpc/react-query';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../services/api-gateway/src/server';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create React hooks for tRPC
export const trpc = createTRPCReact<AppRouter>();

// Get API Gateway URL from environment or use default
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

// Get auth token from secure storage
async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('accessToken');
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

// Create tRPC client configuration
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_GATEWAY_URL}/trpc`,
      async headers() {
        const token = await getAuthToken();
        return {
          authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        };
      },
    }),
  ],
});

// Create vanilla client for use outside React components
export const vanillaTrpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_GATEWAY_URL}/trpc`,
      async headers() {
        const token = await getAuthToken();
        return {
          authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        };
      },
    }),
  ],
});
