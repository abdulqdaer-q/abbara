import { create } from 'zustand';

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
}

export const useOrderStore = create<OrderState>((set, get) => ({
  currentOrder: null,
  orders: [],
  activeOrders: [],
  completedOrders: [],
  isLoading: false,
  error: null,
  draftOrder: {},

  setDraftOrder: (data) => {
    set((state) => ({
      draftOrder: { ...state.draftOrder, ...data },
    }));
  },

  clearDraftOrder: () => set({ draftOrder: {} }),

  setCurrentOrder: (order) => set({ currentOrder: order }),

  setOrders: (orders) => {
    const activeStatuses: OrderStatus[] = ['pending', 'confirmed', 'assigned', 'in_progress'];
    const completedStatuses: OrderStatus[] = ['completed', 'cancelled'];

    set({
      orders,
      activeOrders: orders.filter((o) => activeStatuses.includes(o.status)),
      completedOrders: orders.filter((o) => completedStatuses.includes(o.status)),
    });
  },

  addOrder: (order) => {
    const { orders } = get();
    const updatedOrders = [order, ...orders];
    get().setOrders(updatedOrders);
  },

  updateOrder: (orderId, updates) => {
    const { orders } = get();
    const updatedOrders = orders.map((order) =>
      order.id === orderId ? { ...order, ...updates } : order
    );
    get().setOrders(updatedOrders);

    // Update current order if it's the one being updated
    const { currentOrder } = get();
    if (currentOrder?.id === orderId) {
      set({ currentOrder: { ...currentOrder, ...updates } });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),
}));
