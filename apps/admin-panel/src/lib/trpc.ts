import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../../services/admin-management/src/routers';

export const trpc = createTRPCReact<AppRouter>();

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:4000';

function getAuthToken(): string | null {
  return localStorage.getItem('adminToken');
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${ADMIN_API_URL}/trpc`,
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
