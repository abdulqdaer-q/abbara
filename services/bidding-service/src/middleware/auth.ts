import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../lib/logger';

/**
 * JWT payload shape
 */
interface JwtPayload {
  sub: string; // User ID
  role: 'client' | 'porter' | 'admin' | 'superadmin';
  email?: string;
  iat: number;
  exp: number;
}

/**
 * Extract and verify JWT token from request
 */
export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue without user (publicProcedure will handle)
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: [config.jwtAlgorithm as jwt.Algorithm],
    }) as JwtPayload;

    // Attach user to request
    (req as any).user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };

    logger.debug('User authenticated', {
      userId: decoded.sub,
      role: decoded.role,
    });

    next();
  } catch (error) {
    logger.warn('Invalid JWT token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Invalid token - continue without user
    next();
  }
}

/**
 * Validate porter identity against Auth/Porters service
 * This is a placeholder - in production, this would make an RPC call
 */
export async function validatePorterEligibility(
  porterId: string,
  filters?: Record<string, any>
): Promise<{ eligible: boolean; reason?: string }> {
  // TODO: Implement actual validation against Porters service
  // For now, assume all porters are eligible
  logger.debug('Validating porter eligibility', { porterId, filters });

  // Simulate validation logic
  // In production:
  // - Check porter verification status
  // - Check geo proximity if filters specify location
  // - Check vehicle type if required
  // - Check rating threshold
  // - Check suspension status

  return { eligible: true };
}
