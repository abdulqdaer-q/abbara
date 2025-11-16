import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * Express middleware to require authentication
 * This is used for non-tRPC routes if needed
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as {
      userId: string;
      email: string;
      role: string;
    };

    // Attach user to request
    (req as any).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Express middleware to require specific roles
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Helper to verify JWT token (used in services)
 */
export function verifyAccessToken(token: string): {
  userId: string;
  email: string;
  role: string;
} | null {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as {
      userId: string;
      email: string;
      role: string;
    };
    return decoded;
  } catch {
    return null;
  }
}
