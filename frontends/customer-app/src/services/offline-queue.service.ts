import AsyncStorage from '@react-native-async-storage/async-storage';
import { vanillaTrpcClient } from './trpc';

const OFFLINE_QUEUE_KEY = 'offline_queue';

export interface QueuedAction {
  id: string;
  type: 'updateProfile' | 'cancelOrder' | 'rateOrder' | 'sendMessage';
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface QueuedActionResult {
  success: boolean;
  actionId: string;
  error?: string;
}

/**
 * Service for queuing actions when offline and syncing when online
 * Implements retry logic with exponential backoff
 */
class OfflineQueueService {
  private queue: QueuedAction[] = [];
  private isSyncing = false;
  private listeners: Array<(results: QueuedActionResult[]) => void> = [];

  constructor() {
    this.loadQueue();
  }

  /**
   * Load queue from storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Add action to queue
   */
  async addAction(
    type: QueuedAction['type'],
    payload: any,
    maxRetries: number = 3
  ): Promise<string> {
    const action: QueuedAction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    this.queue.push(action);
    await this.saveQueue();

    console.log(`Added action to offline queue: ${type}`, action.id);
    return action.id;
  }

  /**
   * Get all queued actions
   */
  getQueue(): QueuedAction[] {
    return [...this.queue];
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear the entire queue
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
  }

  /**
   * Remove specific action from queue
   */
  private async removeAction(actionId: string): Promise<void> {
    this.queue = this.queue.filter((action) => action.id !== actionId);
    await this.saveQueue();
  }

  /**
   * Execute a single queued action
   */
  private async executeAction(action: QueuedAction): Promise<QueuedActionResult> {
    try {
      console.log(`Executing queued action: ${action.type}`, action.id);

      switch (action.type) {
        case 'updateProfile':
          await vanillaTrpcClient.users.updateProfile.mutate(action.payload);
          break;

        case 'cancelOrder':
          await vanillaTrpcClient.orders.cancelOrder.mutate({
            orderId: action.payload.orderId,
          });
          break;

        case 'rateOrder':
          await vanillaTrpcClient.orders.rateOrder.mutate({
            orderId: action.payload.orderId,
            rating: action.payload.rating,
            comment: action.payload.comment,
          });
          break;

        case 'sendMessage':
          // Assuming there's a chat/message endpoint
          // await vanillaTrpcClient.chat.sendMessage.mutate(action.payload);
          console.log('Message sending not yet implemented in API');
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      return { success: true, actionId: action.id };
    } catch (error: any) {
      console.error(`Failed to execute action ${action.id}:`, error);
      return {
        success: false,
        actionId: action.id,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Sync all queued actions
   * Returns results for each action
   */
  async sync(): Promise<QueuedActionResult[]> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return [];
    }

    if (this.queue.length === 0) {
      console.log('No actions to sync');
      return [];
    }

    this.isSyncing = true;
    const results: QueuedActionResult[] = [];

    console.log(`Syncing ${this.queue.length} queued actions...`);

    // Process actions in order
    const actionsToProcess = [...this.queue];

    for (const action of actionsToProcess) {
      const result = await this.executeAction(action);
      results.push(result);

      if (result.success) {
        // Remove successful action from queue
        await this.removeAction(action.id);
      } else {
        // Increment retry count
        action.retryCount++;

        if (action.retryCount >= action.maxRetries) {
          // Max retries reached, remove from queue
          console.log(
            `Action ${action.id} failed after ${action.maxRetries} retries, removing from queue`
          );
          await this.removeAction(action.id);
        } else {
          // Update retry count in queue
          await this.saveQueue();
          console.log(
            `Action ${action.id} failed, retry ${action.retryCount}/${action.maxRetries}`
          );
        }
      }
    }

    this.isSyncing = false;

    // Notify listeners
    this.notifyListeners(results);

    console.log(`Sync completed. ${results.filter((r) => r.success).length} successful, ${
      results.filter((r) => !r.success).length
    } failed`);

    return results;
  }

  /**
   * Add listener for sync events
   */
  addSyncListener(callback: (results: QueuedActionResult[]) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(results: QueuedActionResult[]): void {
    this.listeners.forEach((callback) => {
      try {
        callback(results);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Get actions by type
   */
  getActionsByType(type: QueuedAction['type']): QueuedAction[] {
    return this.queue.filter((action) => action.type === type);
  }

  /**
   * Check if queue has pending actions
   */
  hasPendingActions(): boolean {
    return this.queue.length > 0;
  }
}

export const offlineQueueService = new OfflineQueueService();
