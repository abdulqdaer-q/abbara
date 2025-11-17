import { useEffect } from 'react';
import { trpc } from '../services/trpc';
import { useOrderStore } from '../store/usePersistedOrderStore';
import { useIsOnline } from './useNetworkStatus';
import { offlineQueueService } from '../services/offline-queue.service';

/**
 * Hook for managing orders with offline support
 * Automatically syncs with server when online and uses cache when offline
 */
export function useOrders() {
  const isOnline = useIsOnline();
  const { setOrders, setLoading, setError, loadFromCache, orders } = useOrderStore();

  // Load cached orders on mount
  useEffect(() => {
    loadFromCache();
  }, []);

  // Fetch orders from server (only runs when online)
  const ordersQuery = trpc.orders.getOrders.useQuery(undefined, {
    enabled: isOnline,
    refetchInterval: isOnline ? 30000 : false, // Refetch every 30s when online
    onSuccess: (data) => {
      // Update store and cache
      setOrders(data as any);
      setLoading(false);
    },
    onError: (error) => {
      console.error('Failed to fetch orders:', error);
      setError(error.message);
      setLoading(false);

      // Load from cache as fallback
      if (!isOnline) {
        loadFromCache();
      }
    },
  });

  return {
    orders,
    isLoading: ordersQuery.isLoading,
    isError: ordersQuery.isError,
    error: ordersQuery.error,
    refetch: ordersQuery.refetch,
    isOnline,
  };
}

/**
 * Hook for getting a single order with offline support
 */
export function useOrder(orderId: string) {
  const isOnline = useIsOnline();
  const { currentOrder, setCurrentOrder, orders } = useOrderStore();

  // Try to find order in local cache first
  useEffect(() => {
    const cachedOrder = orders.find((o) => o.id === orderId);
    if (cachedOrder && !currentOrder) {
      setCurrentOrder(cachedOrder);
    }
  }, [orderId, orders]);

  // Fetch from server when online
  const orderQuery = trpc.orders.getOrder.useQuery(
    { orderId },
    {
      enabled: isOnline && !!orderId,
      onSuccess: (data) => {
        setCurrentOrder(data as any);
      },
    }
  );

  return {
    order: currentOrder,
    isLoading: orderQuery.isLoading,
    isError: orderQuery.isError,
    error: orderQuery.error,
    refetch: orderQuery.refetch,
    isOnline,
  };
}

/**
 * Hook for canceling an order with offline queue support
 */
export function useCancelOrder() {
  const isOnline = useIsOnline();
  const cancelMutation = trpc.orders.cancelOrder.useMutation();

  const cancelOrder = async (orderId: string) => {
    if (isOnline) {
      // Online - execute immediately
      return cancelMutation.mutateAsync({ orderId });
    } else {
      // Offline - add to queue
      await offlineQueueService.addAction('cancelOrder', { orderId });
      // Optimistically update local state
      useOrderStore.getState().updateOrder(orderId, { status: 'cancelled' });
      return Promise.resolve();
    }
  };

  return {
    cancelOrder,
    isLoading: cancelMutation.isLoading,
    isError: cancelMutation.isError,
    error: cancelMutation.error,
  };
}

/**
 * Hook for rating an order with offline queue support
 */
export function useRateOrder() {
  const isOnline = useIsOnline();
  const rateMutation = trpc.orders.rateOrder.useMutation();

  const rateOrder = async (orderId: string, rating: number, comment?: string) => {
    if (isOnline) {
      // Online - execute immediately
      return rateMutation.mutateAsync({ orderId, rating, comment });
    } else {
      // Offline - add to queue
      await offlineQueueService.addAction('rateOrder', { orderId, rating, comment });
      return Promise.resolve();
    }
  };

  return {
    rateOrder,
    isLoading: rateMutation.isLoading,
    isError: rateMutation.isError,
    error: rateMutation.error,
  };
}
