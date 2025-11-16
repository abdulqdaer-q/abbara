import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OrderDetail, OrderStatus } from '@movenow/common';

interface OrderState {
  activeOrder: OrderDetail | null;
  orders: OrderDetail[];
  isLoading: boolean;
  error: string | null;
}

const initialState: OrderState = {
  activeOrder: null,
  orders: [],
  isLoading: false,
  error: null,
};

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setActiveOrder(state, action: PayloadAction<OrderDetail | null>) {
      state.activeOrder = action.payload;
    },
    setOrders(state, action: PayloadAction<OrderDetail[]>) {
      state.orders = action.payload;
    },
    addOrder(state, action: PayloadAction<OrderDetail>) {
      state.orders.unshift(action.payload);
      state.activeOrder = action.payload;
    },
    updateOrderStatus(state, action: PayloadAction<{ orderId: string; status: OrderStatus }>) {
      const { orderId, status } = action.payload;

      // Update in orders list
      const orderIndex = state.orders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        state.orders[orderIndex].status = status;
      }

      // Update active order if it matches
      if (state.activeOrder?.id === orderId) {
        state.activeOrder.status = status;
      }
    },
    clearActiveOrder(state) {
      state.activeOrder = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setActiveOrder,
  setOrders,
  addOrder,
  updateOrderStatus,
  clearActiveOrder,
} = orderSlice.actions;

export default orderSlice.reducer;
