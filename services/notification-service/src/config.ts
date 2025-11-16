import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Service Configuration
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3005'),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database
  databaseUrl: z.string().url(),

  // Redis
  redisUrl: z.string().url(),

  // RabbitMQ / Message Queue
  rabbitmqUrl: z.string().url(),
  eventQueueName: z.string().default('movenow.events'),

  // Push Notifications - Firebase Cloud Messaging (FCM)
  fcmProjectId: z.string().optional(),
  fcmClientEmail: z.string().email().optional(),
  fcmPrivateKey: z.string().optional(),

  // Email Service (Optional - Nodemailer SMTP)
  emailEnabled: z.string().transform((v) => v === 'true').default('false'),
  emailFrom: z.string().email().default('notifications@movenow.com'),
  smtpHost: z.string().optional(),
  smtpPort: z.string().transform(Number).pipe(z.number()).optional(),
  smtpSecure: z.string().transform((v) => v === 'true').default('false'),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),

  // SMS Service (Optional - Twilio)
  smsEnabled: z.string().transform((v) => v === 'true').default('false'),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),

  // Notification Settings
  maxRetryAttempts: z.string().transform(Number).pipe(z.number().min(0).max(10)).default('3'),
  retryBackoffMs: z.string().transform(Number).pipe(z.number().min(100)).default('1000'),
  notificationBatchSize: z.string().transform(Number).pipe(z.number().min(1).max(1000)).default('100'),
  rateLimitPerUserPerMinute: z.string().transform(Number).pipe(z.number().min(1)).default('10'),
  deduplicationWindowSeconds: z.string().transform(Number).pipe(z.number().min(60)).default('300'),

  // Message Retention
  messageRetentionDays: z.string().transform(Number).pipe(z.number().min(1)).default('90'),
  auditLogRetentionDays: z.string().transform(Number).pipe(z.number().min(1)).default('365'),

  // CORS
  corsOrigin: z.string().default('http://localhost:3000'),

  // Health Check
  healthCheckIntervalMs: z.string().transform(Number).pipe(z.number().min(1000)).default('30000'),
});

type Config = z.infer<typeof configSchema>;

function validateConfig(): Config {
  try {
    const config = configSchema.parse({
      // Service Configuration
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      logLevel: process.env.LOG_LEVEL,

      // Database
      databaseUrl: process.env.DATABASE_URL,

      // Redis
      redisUrl: process.env.REDIS_URL,

      // RabbitMQ
      rabbitmqUrl: process.env.RABBITMQ_URL,
      eventQueueName: process.env.EVENT_QUEUE_NAME,

      // FCM
      fcmProjectId: process.env.FCM_PROJECT_ID,
      fcmClientEmail: process.env.FCM_CLIENT_EMAIL,
      fcmPrivateKey: process.env.FCM_PRIVATE_KEY,

      // Email
      emailEnabled: process.env.EMAIL_ENABLED,
      emailFrom: process.env.EMAIL_FROM,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpSecure: process.env.SMTP_SECURE,
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,

      // SMS
      smsEnabled: process.env.SMS_ENABLED,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,

      // Notification Settings
      maxRetryAttempts: process.env.MAX_RETRY_ATTEMPTS,
      retryBackoffMs: process.env.RETRY_BACKOFF_MS,
      notificationBatchSize: process.env.NOTIFICATION_BATCH_SIZE,
      rateLimitPerUserPerMinute: process.env.RATE_LIMIT_PER_USER_PER_MINUTE,
      deduplicationWindowSeconds: process.env.DEDUPLICATION_WINDOW_SECONDS,

      // Message Retention
      messageRetentionDays: process.env.MESSAGE_RETENTION_DAYS,
      auditLogRetentionDays: process.env.AUDIT_LOG_RETENTION_DAYS,

      // CORS
      corsOrigin: process.env.CORS_ORIGIN,

      // Health Check
      healthCheckIntervalMs: process.env.HEALTH_CHECK_INTERVAL_MS,
    });

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      console.error(error.errors);
      throw new Error('Invalid configuration. Please check your environment variables.');
    }
    throw error;
  }
}

export const config = validateConfig();
