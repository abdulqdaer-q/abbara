import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';

import { RootState } from '../../store';
import { updateOrderStatus } from '../../store/slices/orderSlice';
import { addNotification } from '../../store/slices/notificationSlice';
import { EventType, OrderStatus } from '@movenow/common';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const dispatch = useDispatch();
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // Listen to order status updates
    newSocket.on(EventType.ORDER_CONFIRMED, (data: { orderId: string; status: OrderStatus }) => {
      dispatch(updateOrderStatus(data));
      dispatch(addNotification({
        type: 'success',
        title: 'Order Confirmed',
        message: 'Your order has been confirmed!',
      }));
    });

    newSocket.on(EventType.ORDER_ASSIGNED, (data: { orderId: string; porterId: string }) => {
      dispatch(updateOrderStatus({ orderId: data.orderId, status: 'assigned' }));
      dispatch(addNotification({
        type: 'info',
        title: 'Porter Assigned',
        message: 'A porter has been assigned to your order.',
      }));
    });

    newSocket.on(EventType.ORDER_STARTED, (data: { orderId: string }) => {
      dispatch(updateOrderStatus({ orderId: data.orderId, status: 'in_progress' }));
      dispatch(addNotification({
        type: 'info',
        title: 'Order In Progress',
        message: 'Your order is now in progress!',
      }));
    });

    newSocket.on(EventType.ORDER_COMPLETED, (data: { orderId: string }) => {
      dispatch(updateOrderStatus({ orderId: data.orderId, status: 'completed' }));
      dispatch(addNotification({
        type: 'success',
        title: 'Order Completed',
        message: 'Your order has been completed!',
      }));
    });

    // Listen to porter location updates
    newSocket.on(EventType.PORTER_LOCATION_UPDATED, (data: { porterId: string; lat: number; lng: number }) => {
      // Handle porter location update
      console.log('Porter location updated:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [isAuthenticated, token, dispatch]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
