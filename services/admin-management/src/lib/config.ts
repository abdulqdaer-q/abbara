import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('admin-management-service'),
  KAFKA_GROUP_ID: z.string().default('admin-management-consumer-group'),
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@movenow.com'),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default('changeme'),
  ENABLE_ANALYTICS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_AUDIT_LOGS: z.string().transform(val => val === 'true').default('true'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Validate environment variables
const envValidation = envSchema.safeParse(process.env);

if (!envValidation.success) {
  console.error('❌ Invalid environment variables:', envValidation.error.format());
  process.exit(1);
}

export const config = {
  env: envValidation.data.NODE_ENV,
  port: parseInt(envValidation.data.PORT, 10),
  host: envValidation.data.HOST,
  database: {
    url: envValidation.data.DATABASE_URL,
  },
  jwt: {
    secret: envValidation.data.JWT_SECRET,
    expiresIn: envValidation.data.JWT_EXPIRES_IN,
  },
  kafka: {
    brokers: envValidation.data.KAFKA_BROKERS.split(','),
    clientId: envValidation.data.KAFKA_CLIENT_ID,
    groupId: envValidation.data.KAFKA_GROUP_ID,
  },
  admin: {
    superAdminEmail: envValidation.data.SUPER_ADMIN_EMAIL,
    defaultPassword: envValidation.data.DEFAULT_ADMIN_PASSWORD,
  },
  features: {
    analytics: envValidation.data.ENABLE_ANALYTICS,
    auditLogs: envValidation.data.ENABLE_AUDIT_LOGS,
  },
  rateLimit: {
    windowMs: envValidation.data.RATE_LIMIT_WINDOW_MS,
    maxRequests: envValidation.data.RATE_LIMIT_MAX_REQUESTS,
  },
  logging: {
    level: envValidation.data.LOG_LEVEL,
  },
  isDevelopment: envValidation.data.NODE_ENV === 'development',
  isProduction: envValidation.data.NODE_ENV === 'production',
  isTest: envValidation.data.NODE_ENV === 'test',
} as const;
