import { PrismaClient, RefreshToken } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CreateRefreshTokenInput {
  tokenHash: string;
  userId: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export class RefreshTokenRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new refresh token
   */
  async create(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    logger.debug('Creating refresh token', { userId: input.userId });

    return this.prisma.refreshToken.create({
      data: input,
    });
  }

  /**
   * Find refresh token by hash
   */
  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  /**
   * Find all tokens for a user
   */
  async findByUserId(userId: string): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke a token
   */
  async revoke(tokenHash: string): Promise<RefreshToken> {
    logger.debug('Revoking refresh token', { tokenHash });

    return this.prisma.refreshToken.update({
      where: { tokenHash },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllForUser(userId: string): Promise<number> {
    logger.debug('Revoking all refresh tokens for user', { userId });

    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Delete a token
   */
  async delete(tokenHash: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.delete({
      where: { tokenHash },
    });
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    logger.debug('Deleting expired refresh tokens');

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * Check if token is valid (not revoked and not expired)
   */
  async isValid(tokenHash: string): Promise<boolean> {
    const token = await this.findByHash(tokenHash);

    if (!token) {
      return false;
    }

    if (token.revoked) {
      return false;
    }

    if (token.expiresAt < new Date()) {
      return false;
    }

    return true;
  }
}
