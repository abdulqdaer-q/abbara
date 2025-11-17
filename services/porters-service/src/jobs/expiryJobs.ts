import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../lib/logger';
import jobOfferService from '../services/jobOfferService';
import locationService from '../services/locationService';
import { cleanupExpiredIdempotencyRecords } from '../lib/idempotency';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Job queue for periodic tasks
 */
export const periodicQueue = new Queue('periodic-jobs', {
  connection: {
    url: redisUrl,
  },
});

/**
 * Worker to process periodic jobs
 */
export const periodicWorker = new Worker(
  'periodic-jobs',
  async (job: Job) => {
    logger.info('Processing periodic job', { jobName: job.name });

    try {
      switch (job.name) {
        case 'expire-offers':
          return await expireOffersJob();

        case 'cleanup-location-history':
          return await cleanupLocationHistoryJob();

        case 'cleanup-idempotency-records':
          return await cleanupIdempotencyRecordsJob();

        default:
          logger.warn('Unknown job type', { jobName: job.name });
          return { skipped: true };
      }
    } catch (error) {
      logger.error('Error processing periodic job', {
        jobName: job.name,
        error,
      });
      throw error;
    }
  },
  {
    connection: {
      url: redisUrl,
    },
    concurrency: 1,
  }
);

/**
 * Expire old job offers
 */
async function expireOffersJob() {
  const count = await jobOfferService.expireOffers();
  logger.info('Expired offers job completed', { count });
  return { expired: count };
}

/**
 * Cleanup old location history
 */
async function cleanupLocationHistoryJob() {
  const count = await locationService.cleanupOldHistory();
  logger.info('Location history cleanup job completed', { count });
  return { deleted: count };
}

/**
 * Cleanup expired idempotency records
 */
async function cleanupIdempotencyRecordsJob() {
  const count = await cleanupExpiredIdempotencyRecords();
  logger.info('Idempotency records cleanup job completed', { count });
  return { deleted: count };
}

/**
 * Schedule periodic jobs
 */
export async function schedulePeriodicJobs() {
  logger.info('Scheduling periodic jobs');

  // Expire offers every 10 seconds
  await periodicQueue.add(
    'expire-offers',
    {},
    {
      repeat: {
        every: 10000, // 10 seconds
      },
    }
  );

  // Cleanup location history daily
  await periodicQueue.add(
    'cleanup-location-history',
    {},
    {
      repeat: {
        pattern: '0 2 * * *', // 2 AM daily
      },
    }
  );

  // Cleanup idempotency records every hour
  await periodicQueue.add(
    'cleanup-idempotency-records',
    {},
    {
      repeat: {
        pattern: '0 * * * *', // Every hour
      },
    }
  );

  logger.info('Periodic jobs scheduled');
}

/**
 * Graceful shutdown
 */
export async function closeJobs() {
  await periodicWorker.close();
  await periodicQueue.close();
  logger.info('Background jobs closed');
}

export default {
  schedulePeriodicJobs,
  closeJobs,
};
