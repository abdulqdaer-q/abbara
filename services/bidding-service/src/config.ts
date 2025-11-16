import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Configuration schema with validation
 */
const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().int().min(1).max(65535).default(3002),
  host: z.string().default('0.0.0.0'),

  // Database
  databaseUrl: z.string().url(),

  // Redis
  redisUrl: z.string().url(),
  redisPassword: z.string().optional(),
  redisDb: z.coerce.number().int().min(0).max(15).default(0),

  // Kafka
  kafkaBrokers: z.string().transform((val) => val.split(',')),
  kafkaClientId: z.string().default('bidding-service'),
  kafkaGroupId: z.string().default('bidding-service-group'),

  // JWT
  jwtSecret: z.string().min(32),
  jwtAlgorithm: z.string().default('HS256'),

  // Bidding
  defaultBiddingWindowDurationSec: z.coerce.number().int().min(10).default(300),
  defaultMinBidCents: z.coerce.number().int().min(0).default(1000),
  defaultStrategyId: z.string().default('weighted-score-v1'),
  maxBidsPerPorter: z.coerce.number().int().min(1).default(5),
  bidAcceptanceLockTtlSec: z.coerce.number().int().min(5).default(30),

  // Observability
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  metricsPort: z.coerce.number().int().min(1).max(65535).default(9090),
  enableTracing: z.coerce.boolean().default(true),
  otelExporterEndpoint: z.string().url().optional(),

  // Data retention
  bidRetentionDays: z.coerce.number().int().min(1).default(90),
  auditRetentionDays: z.coerce.number().int().min(1).default(365),
});

/**
 * Parse and validate configuration
 */
export const config = configSchema.parse({
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  host: process.env.HOST,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  redisPassword: process.env.REDIS_PASSWORD,
  redisDb: process.env.REDIS_DB,
  kafkaBrokers: process.env.KAFKA_BROKERS,
  kafkaClientId: process.env.KAFKA_CLIENT_ID,
  kafkaGroupId: process.env.KAFKA_GROUP_ID,
  jwtSecret: process.env.JWT_SECRET,
  jwtAlgorithm: process.env.JWT_ALGORITHM,
  defaultBiddingWindowDurationSec: process.env.DEFAULT_BIDDING_WINDOW_DURATION_SEC,
  defaultMinBidCents: process.env.DEFAULT_MIN_BID_CENTS,
  defaultStrategyId: process.env.DEFAULT_STRATEGY_ID,
  maxBidsPerPorter: process.env.MAX_BIDS_PER_PORTER,
  bidAcceptanceLockTtlSec: process.env.BID_ACCEPTANCE_LOCK_TTL_SEC,
  logLevel: process.env.LOG_LEVEL,
  metricsPort: process.env.METRICS_PORT,
  enableTracing: process.env.ENABLE_TRACING,
  otelExporterEndpoint: process.env.OTEL_EXPORTER_ENDPOINT,
  bidRetentionDays: process.env.BID_RETENTION_DAYS,
  auditRetentionDays: process.env.AUDIT_RETENTION_DAYS,
});

export type Config = z.infer<typeof configSchema>;
