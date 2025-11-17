import { create } from 'zustand';
import { offlineService } from '../services/offline.service';

export type OrderStatus = 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type VehicleType = 'sedan' | 'suv' | 'van' | 'truck';

export interface Location {
  address: string;
  lat: number;
  lng: number;
}

export interface OrderItem {
  id: string;
  description: string;
  photos: string[];
  weight?: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  porterId?: string;
  vehicleType: VehicleType;
  portersRequired: number;
  pickupLocation: Location;
  dropoffLocation: Location;
  items: OrderItem[];
  specialInstructions?: string;
  scheduledFor?: Date;
  status: OrderStatus;
  estimatedPrice?: number;
  finalPrice?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

export interface CreateOrderData {
  vehicleType: VehicleType;
  portersRequired: number;
  pickupLocation: Location;
  dropoffLocation: Location;
  items: Omit<OrderItem, 'id'>[];
  specialInstructions?: string;
  scheduledFor?: Date;
}

interface OrderState {
  currentOrder: Order | null;
  orders: Order[];
  activeOrders: Order[];
  completedOrders: Order[];
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;

  // Draft order (for multi-step order creation)
  draftOrder: Partial<CreateOrderData>;

  // Actions
  setDraftOrder: (data: Partial<CreateOrderData>) => void;
  clearDraftOrder: () => void;
  setCurrentOrder: (order: Order | null) => void;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setHydrated: (hydrated: boolean) => void;
  loadFromCache: () => Promise<void>;
}

/**
 * Persisted order store with offline support
 * Automatically caches orders for offline access
 */
export const useOrderStore = create<OrderState>((set, get) => ({
  currentOrder: null,
  orders: [],
  activeOrders: [],
  completedOrders: [],
  isLoading: false,
  error: null,
  isHydrated: false,
  draftOrder: {},

  setDraftOrder: (data) => {
    set((state) => ({
      draftOrder: { ...state.draftOrder, ...data },
    }));
  },

  clearDraftOrder: () => set({ draftOrder: {} }),

  setCurrentOrder: (order) => set({ currentOrder: order }),

  setOrders: async (orders) => {
    const activeStatuses: OrderStatus[] = ['pending', 'confirmed', 'assigned', 'in_progress'];
    const completedStatuses: OrderStatus[] = ['completed', 'cancelled'];

    const activeOrders = orders.filter((o) => activeStatuses.includes(o.status));
    const completedOrders = orders.filter((o) => completedStatuses.includes(o.status));

    set({
      orders,
      activeOrders,
      completedOrders,
    });

    // Cache orders for offline access
    await offlineService.cacheOrders(orders);
  },

  addOrder: (order) => {
    const { orders } = get();
    const updatedOrders = [order, ...orders];
    get().setOrders(updatedOrders);
  },

  updateOrder: async (orderId, updates) => {
    const { orders } = get();
    const updatedOrders = orders.map((order) =>
      order.id === orderId ? { ...order, ...updates } : order
    );
    await get().setOrders(updatedOrders);

    // Update current order if it's the one being updated
    const { currentOrder } = get();
    if (currentOrder?.id === orderId) {
      set({ currentOrder: { ...currentOrder, ...updates } });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  setHydrated: (hydrated) => set({ isHydrated: hydrated }),

  loadFromCache: async () => {
    try {
      const cachedOrders = await offlineService.getCachedOrders();
      if (cachedOrders.length > 0) {
        const activeStatuses: OrderStatus[] = ['pending', 'confirmed', 'assigned', 'in_progress'];
        const completedStatuses: OrderStatus[] = ['completed', 'cancelled'];

        set({
          orders: cachedOrders,
          activeOrders: cachedOrders.filter((o) => activeStatuses.includes(o.status)),
          completedOrders: cachedOrders.filter((o) => completedStatuses.includes(o.status)),
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    } catch (error) {
      console.error('Failed to load orders from cache:', error);
      set({ isHydrated: true });
    }
  },
}));
