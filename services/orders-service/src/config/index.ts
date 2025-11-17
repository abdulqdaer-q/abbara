import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  logLevel: string;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
  services: {
    pricingServiceUrl: string;
    paymentsServiceUrl: string;
  };
  idempotency: {
    ttlSeconds: number;
  };
  metrics: {
    port: number;
  };
  cors: {
    origin: string;
  };
  jwt: {
    secret: string;
  };
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config: Config = {
  port: parseInt(getEnv('PORT', '4001'), 10),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  logLevel: getEnv('LOG_LEVEL', 'info'),
  database: {
    url: getEnv('DATABASE_URL'),
  },
  redis: {
    url: getEnv('REDIS_URL', 'redis://localhost:6379'),
  },
  kafka: {
    brokers: getEnv('KAFKA_BROKERS', 'localhost:9092').split(','),
    clientId: getEnv('KAFKA_CLIENT_ID', 'orders-service'),
    groupId: getEnv('KAFKA_GROUP_ID', 'orders-service-group'),
  },
  services: {
    pricingServiceUrl: getEnv('PRICING_SERVICE_URL', 'http://localhost:4002/trpc'),
    paymentsServiceUrl: getEnv('PAYMENTS_SERVICE_URL', 'http://localhost:4003/trpc'),
  },
  idempotency: {
    ttlSeconds: parseInt(getEnv('IDEMPOTENCY_TTL_SECONDS', '86400'), 10),
  },
  metrics: {
    port: parseInt(getEnv('METRICS_PORT', '9090'), 10),
  },
  cors: {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
  },
  jwt: {
    secret: getEnv('JWT_SECRET'),
  },
};
