import { PrismaClient, PasswordResetToken } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export class PasswordResetRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a password reset token
   */
  async create(input: CreatePasswordResetTokenInput): Promise<PasswordResetToken> {
    logger.debug('Creating password reset token', { userId: input.userId });

    return this.prisma.passwordResetToken.create({
      data: input,
    });
  }

  /**
   * Find token by hash
   */
  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  /**
   * Mark token as used
   */
  async markAsUsed(tokenHash: string): Promise<PasswordResetToken> {
    logger.debug('Marking password reset token as used', { tokenHash });

    return this.prisma.passwordResetToken.update({
      where: { tokenHash },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    logger.debug('Deleting expired password reset tokens');

    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * Invalidate all tokens for a user
   */
  async invalidateForUser(userId: string): Promise<number> {
    logger.debug('Invalidating all password reset tokens for user', { userId });

    const result = await this.prisma.passwordResetToken.updateMany({
      where: { userId, used: false },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Check if token is valid
   */
  async isValid(tokenHash: string): Promise<boolean> {
    const token = await this.findByHash(tokenHash);

    if (!token) {
      return false;
    }

    if (token.used) {
      return false;
    }

    if (token.expiresAt < new Date()) {
      return false;
    }

    return true;
  }
}
