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
    socketSecret: string;
    accessExpiry: string;
    socketExpiry: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    sessionTimeout: number;
    heartbeatInterval: number;
  };
  topics: {
    orderEvents: string;
    porterEvents: string;
    notificationEvents: string;
    chatEvents: string;
  };
  rateLimit: {
    points: number;
    duration: number;
    location: {
      points: number;
      duration: number;
    };
    chat: {
      points: number;
      duration: number;
    };
  };
  location: {
    sampleRate: number;
    ttl: number;
  };
  session: {
    ttl: number;
    subscriptionTtl: number;
  };
  logging: {
    level: string;
  };
  metrics: {
    port: number;
  };
  tracing: {
    enabled: boolean;
    jaegerEndpoint?: string;
  };
  performance: {
    maxConnections: number;
    maxPayloadSize: number;
    pingTimeout: number;
    pingInterval: number;
  };
  security: {
    tlsEnabled: boolean;
    tlsCertPath?: string;
    tlsKeyPath?: string;
  };
  serviceName: string;
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value !== undefined) {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`Missing required environment variable: ${key}`);
};

export const config: Config = {
  server: {
    env: getEnv('NODE_ENV', 'development'),
    port: parseInt(getEnv('PORT', '3002'), 10),
    host: getEnv('HOST', '0.0.0.0'),
    corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:3001').split(','),
  },
  jwt: {
    accessSecret: getEnv('JWT_ACCESS_SECRET'),
    socketSecret: getEnv('JWT_SOCKET_SECRET'),
    accessExpiry: getEnv('JWT_ACCESS_EXPIRY', '15m'),
    socketExpiry: getEnv('JWT_SOCKET_EXPIRY', '24h'),
  },
  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: parseInt(getEnv('REDIS_PORT', '6379'), 10),
    password: getEnv('REDIS_PASSWORD', ''),
    db: parseInt(getEnv('REDIS_DB', '0'), 10),
    keyPrefix: getEnv('REDIS_KEY_PREFIX', 'movenow:realtime:'),
  },
  kafka: {
    brokers: getEnv('KAFKA_BROKERS', 'localhost:9092').split(','),
    clientId: getEnv('KAFKA_CLIENT_ID', 'realtime-gateway'),
    groupId: getEnv('KAFKA_GROUP_ID', 'realtime-gateway-group'),
    sessionTimeout: parseInt(getEnv('KAFKA_CONSUMER_SESSION_TIMEOUT', '30000'), 10),
    heartbeatInterval: parseInt(getEnv('KAFKA_CONSUMER_HEARTBEAT_INTERVAL', '3000'), 10),
  },
  topics: {
    orderEvents: getEnv('KAFKA_TOPIC_ORDER_EVENTS', 'order-events'),
    porterEvents: getEnv('KAFKA_TOPIC_PORTER_EVENTS', 'porter-events'),
    notificationEvents: getEnv('KAFKA_TOPIC_NOTIFICATION_EVENTS', 'notification-events'),
    chatEvents: getEnv('KAFKA_TOPIC_CHAT_EVENTS', 'chat-events'),
  },
  rateLimit: {
    points: parseInt(getEnv('RATE_LIMIT_POINTS', '100'), 10),
    duration: parseInt(getEnv('RATE_LIMIT_DURATION', '60'), 10),
    location: {
      points: parseInt(getEnv('RATE_LIMIT_LOCATION_POINTS', '1000'), 10),
      duration: parseInt(getEnv('RATE_LIMIT_LOCATION_DURATION', '60'), 10),
    },
    chat: {
      points: parseInt(getEnv('RATE_LIMIT_CHAT_POINTS', '50'), 10),
      duration: parseInt(getEnv('RATE_LIMIT_CHAT_DURATION', '60'), 10),
    },
  },
  location: {
    sampleRate: parseInt(getEnv('LOCATION_SAMPLE_RATE', '10'), 10),
    ttl: parseInt(getEnv('LOCATION_TTL', '3600'), 10),
  },
  session: {
    ttl: parseInt(getEnv('SESSION_TTL', '86400'), 10),
    subscriptionTtl: parseInt(getEnv('SUBSCRIPTION_TTL', '86400'), 10),
  },
  logging: {
    level: getEnv('LOG_LEVEL', 'info'),
  },
  metrics: {
    port: parseInt(getEnv('METRICS_PORT', '9090'), 10),
  },
  tracing: {
    enabled: getEnv('ENABLE_TRACING', 'true') === 'true',
    jaegerEndpoint: getEnv('JAEGER_ENDPOINT', ''),
  },
  performance: {
    maxConnections: parseInt(getEnv('MAX_CONNECTIONS', '10000'), 10),
    maxPayloadSize: parseInt(getEnv('MAX_PAYLOAD_SIZE', '1048576'), 10),
    pingTimeout: parseInt(getEnv('PING_TIMEOUT', '20000'), 10),
    pingInterval: parseInt(getEnv('PING_INTERVAL', '25000'), 10),
  },
  security: {
    tlsEnabled: getEnv('TLS_ENABLED', 'false') === 'true',
    tlsCertPath: getEnv('TLS_CERT_PATH', ''),
    tlsKeyPath: getEnv('TLS_KEY_PATH', ''),
  },
  serviceName: getEnv('SERVICE_NAME', 'realtime-gateway'),
};
