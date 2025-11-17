import { io, Socket } from 'socket.io-client';
import { vanillaTrpcClient } from './trpc';
import { authService } from './auth.service';

const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3007';

type SocketEventCallback = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  /**
   * Connect to WebSocket server
   */
  async connect(namespace: 'client' | 'porter' = 'client'): Promise<void> {
    if (this.socket?.connected || this.isConnecting) {
      console.log('Socket already connected or connecting');
      return;
    }

    this.isConnecting = true;

    try {
      // Get socket authentication token from API Gateway
      const response = await vanillaTrpcClient.realtime.subscribeToNamespace.query({
        namespace,
      });

      const { url, token } = response;

      // Create socket connection
      this.socket = io(url || WEBSOCKET_URL, {
        auth: {
          token,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.setupEventListeners();

      console.log('Socket connection initiated');
    } catch (error) {
      console.error('Failed to connect to socket:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      this.isConnecting = false;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.socket?.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: SocketEventCallback): void {
    if (!this.socket) {
      console.warn('Socket not connected. Call connect() first.');
      return;
    }

    this.socket.on(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: SocketEventCallback): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected. Cannot emit event:', event);
      return;
    }

    this.socket.emit(event, ...args);
  }

  /**
   * Subscribe to order updates
   */
  subscribeToOrderUpdates(orderId: string, callback: (update: any) => void): void {
    this.on(`order:${orderId}:update`, callback);
  }

  /**
   * Unsubscribe from order updates
   */
  unsubscribeFromOrderUpdates(orderId: string, callback?: (update: any) => void): void {
    this.off(`order:${orderId}:update`, callback);
  }

  /**
   * Subscribe to porter location updates
   */
  subscribeToPorterLocation(porterId: string, callback: (location: any) => void): void {
    this.on(`porter:${porterId}:location`, callback);
  }

  /**
   * Unsubscribe from porter location updates
   */
  unsubscribeFromPorterLocation(porterId: string, callback?: (location: any) => void): void {
    this.off(`porter:${porterId}:location`, callback);
  }

  /**
   * Subscribe to chat messages
   */
  subscribeToChatMessages(orderId: string, callback: (message: any) => void): void {
    this.on(`order:${orderId}:message`, callback);
  }

  /**
   * Unsubscribe from chat messages
   */
  unsubscribeFromChatMessages(orderId: string, callback?: (message: any) => void): void {
    this.off(`order:${orderId}:message`, callback);
  }

  /**
   * Send a chat message
   */
  sendChatMessage(orderId: string, message: string, attachments?: string[]): void {
    this.emit('order:message:send', {
      orderId,
      message,
      attachments,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Refresh socket authentication token
   */
  async refreshToken(): Promise<void> {
    try {
      const response = await vanillaTrpcClient.realtime.refreshSocketToken.query();
      const { token } = response;

      if (this.socket) {
        this.socket.auth = { token };
        this.socket.disconnect().connect();
      }
    } catch (error) {
      console.error('Failed to refresh socket token:', error);
      throw error;
    }
  }
}

export const socketService = new SocketService();
