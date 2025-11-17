import dotenv from 'dotenv';

dotenv.config();

/**
 * Service configuration loaded from environment variables
 */
export const config = {
  // Service
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'pricing-service',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/movenow_pricing',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisCacheTtlSeconds: parseInt(process.env.REDIS_CACHE_TTL_SECONDS || '3600', 10),

  // Maps Provider (Google Maps)
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  mapsProviderEnabled: process.env.MAPS_PROVIDER_ENABLED === 'true',
  distanceCacheTtlSeconds: parseInt(process.env.DISTANCE_CACHE_TTL_SECONDS || '86400', 10), // 24 hours

  // Pricing defaults
  defaultCurrency: (process.env.DEFAULT_CURRENCY || 'USD') as 'USD' | 'EUR' | 'GBP',
  defaultTaxRate: parseFloat(process.env.DEFAULT_TAX_RATE || '0.08'), // 8%
  defaultServiceFeeRate: parseFloat(process.env.DEFAULT_SERVICE_FEE_RATE || '0.05'), // 5%

  // Pricing rules
  minFareCents: parseInt(process.env.MIN_FARE_CENTS || '500', 10), // $5.00
  maxSurgeMultiplier: parseFloat(process.env.MAX_SURGE_MULTIPLIER || '3.0'), // 3x

  // Fallback estimates (when maps provider unavailable)
  fallbackSpeedKmh: parseInt(process.env.FALLBACK_SPEED_KMH || '40', 10),

  // Rate limiting
  estimateRateLimitPerMinute: parseInt(process.env.ESTIMATE_RATE_LIMIT_PER_MINUTE || '100', 10),

  // Observability
  logLevel: process.env.LOG_LEVEL || 'info',
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  enableTracing: process.env.ENABLE_TRACING !== 'false',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',

  // Admin
  adminApiKey: process.env.ADMIN_API_KEY || 'dev-admin-key',
} as const;

/**
 * Validate required configuration
 */
export function validateConfig() {
  const requiredInProduction = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'ADMIN_API_KEY',
  ];

  if (config.nodeEnv === 'production') {
    const missing = requiredInProduction.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
    }

    if (config.mapsProviderEnabled && !config.googleMapsApiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is required when MAPS_PROVIDER_ENABLED is true');
    }
  }
}
