import { createTRPCReact } from '@trpc/react-query';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../services/api-gateway/src/server';

export const trpc = createTRPCReact<AppRouter>();

const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000';

function getAuthToken(): string | null {
  return localStorage.getItem('accessToken');
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_GATEWAY_URL}/trpc`,
      headers() {
        const token = getAuthToken();
        return {
          authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        };
      },
    }),
  ],
});

export const vanillaTrpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_GATEWAY_URL}/trpc`,
      headers() {
        const token = getAuthToken();
        return {
          authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        };
      },
    }),
  ],
});
