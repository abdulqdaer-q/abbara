import { prisma } from '../lib/prisma';
import { getSessionRedis } from '../lib/redis';
import { logger } from '../lib/logger';

/**
 * Redis keys:
 * - porter:socket:{porterId} -> Set of socket IDs
 * - socket:porter:{socketId} -> porterId
 */

export class DeviceSessionService {
  /**
   * Register or update a device session
   */
  async registerDevice(
    porterId: string,
    deviceId: string,
    deviceName?: string,
    deviceType?: string,
    pushToken?: string,
    userAgent?: string,
    ipAddress?: string
  ) {
    const session = await prisma.deviceSession.upsert({
      where: { deviceId },
      create: {
        porterId,
        deviceId,
        deviceName,
        deviceType,
        pushToken,
        userAgent,
        ipAddress,
        isActive: true,
        lastActiveAt: new Date(),
      },
      update: {
        deviceName,
        deviceType,
        pushToken,
        userAgent,
        ipAddress,
        isActive: true,
        lastActiveAt: new Date(),
      },
    });

    logger.info('Device session registered', {
      porterId,
      deviceId,
      deviceType,
    });

    return session;
  }

  /**
   * Map socket ID to porter (for realtime messaging)
   */
  async mapSocket(porterId: string, socketId: string, deviceId?: string): Promise<void> {
    const redis = getSessionRedis();

    // Add socket to porter's socket set
    await redis.sAdd(`porter:socket:${porterId}`, socketId);

    // Map socket to porter
    await redis.set(`socket:porter:${socketId}`, porterId, { EX: 3600 });

    // Update device session with socket ID
    if (deviceId) {
      await prisma.deviceSession.update({
        where: { deviceId },
        data: { socketId },
      });
    }

    logger.debug('Socket mapped to porter', { porterId, socketId });
  }

  /**
   * Remove socket mapping
   */
  async unmapSocket(socketId: string): Promise<void> {
    const redis = getSessionRedis();

    // Get porter ID from socket
    const porterId = await redis.get(`socket:porter:${socketId}`);

    if (porterId) {
      // Remove from porter's socket set
      await redis.sRem(`porter:socket:${porterId}`, socketId);
    }

    // Remove socket mapping
    await redis.del(`socket:porter:${socketId}`);

    // Clear socket ID from device session
    await prisma.deviceSession.updateMany({
      where: { socketId },
      data: { socketId: null },
    });

    logger.debug('Socket unmapped', { porterId, socketId });
  }

  /**
   * Get all socket IDs for a porter
   */
  async getPorterSockets(porterId: string): Promise<string[]> {
    const redis = getSessionRedis();
    return await redis.sMembers(`porter:socket:${porterId}`);
  }

  /**
   * Get porter ID from socket ID
   */
  async getSocketPorter(socketId: string): Promise<string | null> {
    const redis = getSessionRedis();
    return await redis.get(`socket:porter:${socketId}`);
  }

  /**
   * Get all active devices for a porter
   */
  async getPorterDevices(porterId: string) {
    return await prisma.deviceSession.findMany({
      where: {
        porterId,
        isActive: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * Get push tokens for a porter (for notifications)
   */
  async getPorterPushTokens(porterId: string): Promise<string[]> {
    const devices = await prisma.deviceSession.findMany({
      where: {
        porterId,
        isActive: true,
        pushToken: { not: null },
      },
      select: { pushToken: true },
    });

    return devices
      .map((d) => d.pushToken)
      .filter((token): token is string => token !== null);
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(deviceId: string) {
    return await prisma.deviceSession.update({
      where: { deviceId },
      data: { isActive: false },
    });
  }

  /**
   * Update device activity timestamp
   */
  async updateDeviceActivity(deviceId: string) {
    return await prisma.deviceSession.update({
      where: { deviceId },
      data: { lastActiveAt: new Date() },
    });
  }
}

export default new DeviceSessionService();
