import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

/**
 * Redis client instances for different databases
 * - DB 0: Session/socket mappings
 * - DB 1: Availability state (online/offline)
 * - DB 2: Location data (last-known location)
 */

let sessionRedis: RedisClientType;
let availabilityRedis: RedisClientType;
let locationRedis: RedisClientType;

export async function initRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // Session Redis (DB 0)
  sessionRedis = createClient({
    url: redisUrl,
    database: parseInt(process.env.REDIS_SESSION_DB || '0'),
  });

  sessionRedis.on('error', (err) => logger.error('Session Redis error', { error: err }));
  sessionRedis.on('connect', () => logger.info('Session Redis connected'));

  await sessionRedis.connect();

  // Availability Redis (DB 1)
  availabilityRedis = createClient({
    url: redisUrl,
    database: parseInt(process.env.REDIS_AVAILABILITY_DB || '1'),
  });

  availabilityRedis.on('error', (err) => logger.error('Availability Redis error', { error: err }));
  availabilityRedis.on('connect', () => logger.info('Availability Redis connected'));

  await availabilityRedis.connect();

  // Location Redis (DB 2)
  locationRedis = createClient({
    url: redisUrl,
    database: parseInt(process.env.REDIS_LOCATION_DB || '2'),
  });

  locationRedis.on('error', (err) => logger.error('Location Redis error', { error: err }));
  locationRedis.on('connect', () => logger.info('Location Redis connected'));

  await locationRedis.connect();

  logger.info('All Redis clients initialized');
}

export function getSessionRedis(): RedisClientType {
  if (!sessionRedis) {
    throw new Error('Session Redis not initialized. Call initRedis() first.');
  }
  return sessionRedis;
}

export function getAvailabilityRedis(): RedisClientType {
  if (!availabilityRedis) {
    throw new Error('Availability Redis not initialized. Call initRedis() first.');
  }
  return availabilityRedis;
}

export function getLocationRedis(): RedisClientType {
  if (!locationRedis) {
    throw new Error('Location Redis not initialized. Call initRedis() first.');
  }
  return locationRedis;
}

export async function closeRedis() {
  if (sessionRedis) await sessionRedis.quit();
  if (availabilityRedis) await availabilityRedis.quit();
  if (locationRedis) await locationRedis.quit();
  logger.info('All Redis clients disconnected');
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await closeRedis();
});

export default {
  initRedis,
  getSessionRedis,
  getAvailabilityRedis,
  getLocationRedis,
  closeRedis,
};
