import { Client, TravelMode } from '@googlemaps/google-maps-services-js';
import { config } from '../config';
import { logger, logExternalCall } from '../lib/logger';
import { getCached, setCached } from '../lib/redis';
import { prisma } from '../lib/db';
import crypto from 'crypto';

const mapsClient = new Client({});

export interface DistanceTimeResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  cached: boolean;
}

/**
 * Generate cache key for route
 */
function generateRouteHash(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): string {
  const key = `${originLat.toFixed(6)},${originLng.toFixed(6)}-${destLat.toFixed(6)},${destLng.toFixed(6)}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

/**
 * Get distance and time between two points
 * Uses Redis cache first, then database cache, then external API
 */
export async function getDistanceAndTime(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  correlationId: string
): Promise<DistanceTimeResult> {
  const routeHash = generateRouteHash(originLat, originLng, destLat, destLng);
  const cacheKey = `distance:${routeHash}`;

  // Try Redis cache first
  const cachedResult = await getCached<DistanceTimeResult>(cacheKey, correlationId);
  if (cachedResult) {
    return { ...cachedResult, cached: true };
  }

  // Try database cache
  const dbCached = await prisma.distanceCache.findUnique({
    where: { routeHash },
  });

  if (dbCached && dbCached.expiresAt > new Date()) {
    // Update hit count
    await prisma.distanceCache.update({
      where: { id: dbCached.id },
      data: {
        hitCount: { increment: 1 },
        lastHitAt: new Date(),
      },
    });

    const result: DistanceTimeResult = {
      distanceMeters: dbCached.distanceMeters,
      durationSeconds: dbCached.durationSeconds,
      polyline: dbCached.polyline || undefined,
      cached: true,
    };

    // Store in Redis for faster access next time
    await setCached(cacheKey, result, config.redisCacheTtlSeconds, correlationId);

    return result;
  }

  // If maps provider disabled, use fallback heuristic
  if (!config.mapsProviderEnabled) {
    return calculateFallbackDistance(originLat, originLng, destLat, destLng);
  }

  // Call external API
  const startTime = Date.now();
  let error: string | undefined;

  try {
    const response = await mapsClient.distancematrix({
      params: {
        origins: [`${originLat},${originLng}`],
        destinations: [`${destLat},${destLng}`],
        mode: TravelMode.driving,
        key: config.googleMapsApiKey,
      },
    });

    const element = response.data.rows[0]?.elements[0];

    if (element?.status === 'OK') {
      const result: DistanceTimeResult = {
        distanceMeters: element.distance.value,
        durationSeconds: element.duration.value,
        cached: false,
      };

      // Cache in both Redis and database
      const expiresAt = new Date(Date.now() + config.distanceCacheTtlSeconds * 1000);

      await Promise.all([
        setCached(cacheKey, result, config.distanceCacheTtlSeconds, correlationId),
        prisma.distanceCache.upsert({
          where: { routeHash },
          create: {
            originLat,
            originLng,
            destLat,
            destLng,
            routeHash,
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            expiresAt,
            provider: 'google_maps',
          },
          update: {
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            expiresAt,
            hitCount: { increment: 1 },
            lastHitAt: new Date(),
          },
        }),
      ]);

      logExternalCall({
        correlationId,
        provider: 'google_maps',
        operation: 'distance_matrix',
        durationMs: Date.now() - startTime,
        success: true,
      });

      return result;
    }

    error = `Maps API error: ${element?.status}`;
    throw new Error(error);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);

    logExternalCall({
      correlationId,
      provider: 'google_maps',
      operation: 'distance_matrix',
      durationMs: Date.now() - startTime,
      success: false,
      error,
    });

    logger.warn('Maps provider unavailable, using fallback', { error, correlationId });

    // Fallback to heuristic calculation
    return calculateFallbackDistance(originLat, originLng, destLat, destLng);
  }
}

/**
 * Calculate fallback distance using Haversine formula
 */
function calculateFallbackDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): DistanceTimeResult {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = Math.round(R * c);

  // Estimate duration based on fallback speed
  const distanceKm = distanceMeters / 1000;
  const durationHours = distanceKm / config.fallbackSpeedKmh;
  const durationSeconds = Math.round(durationHours * 3600);

  logger.info('Using fallback distance calculation', {
    distanceMeters,
    durationSeconds,
  });

  return {
    distanceMeters,
    durationSeconds,
    cached: false,
  };
}

/**
 * Get distance and time for multi-stop route
 */
export async function getMultiStopDistance(
  waypoints: Array<{ lat: number; lng: number }>,
  correlationId: string
): Promise<DistanceTimeResult> {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints required');
  }

  // For simplicity, sum up each leg
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const origin = waypoints[i];
    const destination = waypoints[i + 1];

    const leg = await getDistanceAndTime(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng,
      correlationId
    );

    totalDistance += leg.distanceMeters;
    totalDuration += leg.durationSeconds;
  }

  return {
    distanceMeters: totalDistance,
    durationSeconds: totalDuration,
    cached: false,
  };
}
