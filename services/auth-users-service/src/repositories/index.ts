import { PrismaClient } from '@prisma/client';
import { UserRepository } from './userRepository';
import { RefreshTokenRepository } from './refreshTokenRepository';
import { PorterProfileRepository } from './porterProfileRepository';
import { PasswordResetRepository } from './passwordResetRepository';

export class Repositories {
  public users: UserRepository;
  public refreshTokens: RefreshTokenRepository;
  public porterProfiles: PorterProfileRepository;
  public passwordResets: PasswordResetRepository;

  constructor(private prisma: PrismaClient) {
    this.users = new UserRepository(prisma);
    this.refreshTokens = new RefreshTokenRepository(prisma);
    this.porterProfiles = new PorterProfileRepository(prisma);
    this.passwordResets = new PasswordResetRepository(prisma);
  }

  /**
   * Get Prisma client for transactions
   */
  getPrisma(): PrismaClient {
    return this.prisma;
  }
}

export * from './userRepository';
export * from './refreshTokenRepository';
export * from './porterProfileRepository';
export * from './passwordResetRepository';
