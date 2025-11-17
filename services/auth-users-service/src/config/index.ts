import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration schema with validation
 */
const ConfigSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  SERVICE_NAME: z.string().default('auth-users-service'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT Configuration
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  JWT_ALGORITHM: z.enum(['RS256', 'HS256']).default('RS256'),

  // RSA Keys (optional for RS256)
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),

  // Password Hashing
  ARGON2_MEMORY_COST: z.coerce.number().default(65536), // 64 MB
  ARGON2_TIME_COST: z.coerce.number().default(3),
  ARGON2_PARALLELISM: z.coerce.number().default(4),

  // Password Reset
  PASSWORD_RESET_TOKEN_EXPIRY: z.string().default('1h'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(5),

  // Message Bus (Kafka or RabbitMQ)
  MESSAGE_BUS_TYPE: z.enum(['kafka', 'rabbitmq']).default('kafka'),
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().default('auth-users-service'),
  KAFKA_TOPIC_PREFIX: z.string().default('movenow'),
  RABBITMQ_URL: z.string().url().optional(),

  // Social Login (Optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),

  // Monitoring
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9090),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load and validate configuration
 */
function loadConfig(): Config {
  try {
    return ConfigSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export const config = loadConfig();

/**
 * Helper to check if running in production
 */
export const isProduction = config.NODE_ENV === 'production';

/**
 * Helper to check if running in development
 */
export const isDevelopment = config.NODE_ENV === 'development';

/**
 * Helper to check if running in test
 */
export const isTest = config.NODE_ENV === 'test';
