import dotenv from 'dotenv';

dotenv.config();

interface Config {
  server: {
    env: string;
    port: number;
    host: string;
    corsOrigin: string[];
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiry: string;
    refreshExpiry: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  services: {
    auth: string;
    orders: string;
    pricing: string;
    porters: string;
    payments: string;
    notifications: string;
    realtime: string;
  };
  logging: {
    level: string;
  };
  serviceName: string;
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config: Config = {
  server: {
    env: getEnv('NODE_ENV', 'development'),
    port: parseInt(getEnv('PORT', '3000'), 10),
    host: getEnv('HOST', '0.0.0.0'),
    corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:3001').split(','),
  },
  jwt: {
    accessSecret: getEnv('JWT_ACCESS_SECRET'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET'),
    accessExpiry: getEnv('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: getEnv('JWT_REFRESH_EXPIRY', '7d'),
  },
  rateLimit: {
    windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    maxRequests: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },
  services: {
    auth: getEnv('AUTH_SERVICE_URL'),
    orders: getEnv('ORDERS_SERVICE_URL'),
    pricing: getEnv('PRICING_SERVICE_URL'),
    porters: getEnv('PORTERS_SERVICE_URL'),
    payments: getEnv('PAYMENTS_SERVICE_URL'),
    notifications: getEnv('NOTIFICATIONS_SERVICE_URL'),
    realtime: getEnv('REALTIME_SERVICE_URL'),
  },
  logging: {
    level: getEnv('LOG_LEVEL', 'info'),
  },
  serviceName: getEnv('SERVICE_NAME', 'api-gateway'),
};
