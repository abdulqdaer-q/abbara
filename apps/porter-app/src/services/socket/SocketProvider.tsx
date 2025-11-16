import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { addJobRequest } from '../../store/slices/jobSlice';

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

    const newSocket = io(SOCKET_URL, {
      auth: { token },
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

    newSocket.on('job.new', (data: any) => {
      dispatch(addJobRequest(data));
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
