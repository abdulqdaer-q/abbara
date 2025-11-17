import { TRPCError } from '@trpc/server';
import { appRouter } from '../../src/routers';
import { createContext } from '../../src/trpc/context';
import { UserRepository } from '../../src/repositories/userRepository';
import { RefreshTokenRepository } from '../../src/repositories/refreshTokenRepository';
import { PasswordResetRepository } from '../../src/repositories/passwordResetRepository';
import { hashPassword } from '../../src/utils/password';
import { verifyRefreshToken } from '../../src/utils/jwt';

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/middleware/rateLimit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(undefined),
}));

const mockPrisma = {
  user: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordReset: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as any;

const mockEventPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

describe('Auth Router Integration Tests', () => {
  let caller: any;
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let passwordResetRepo: PasswordResetRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    userRepo = new UserRepository(mockPrisma);
    refreshTokenRepo = new RefreshTokenRepository(mockPrisma);
    passwordResetRepo = new PasswordResetRepository(mockPrisma);

    const ctx = {
      repositories: {
        users: userRepo,
        refreshTokens: refreshTokenRepo,
        passwordResets: passwordResetRepo,
      },
      eventPublisher: mockEventPublisher,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      correlationId: 'test-correlation-id',
    };

    caller = appRouter.createCaller(ctx);
  });

  describe('register', () => {
    it('should register a new user with email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        displayName: 'Test User',
        role: 'CUSTOMER',
        avatarUrl: null,
        emailVerified: false,
        phoneVerified: false,
        passwordHash: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await caller.auth.register({
        email: 'test@example.com',
        password: 'StrongPass123!',
        displayName: 'Test User',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UserCreated',
          data: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      );
    });

    it('should register a new user with phone', async () => {
      const mockUser = {
        id: 'user-2',
        email: null,
        phone: '+1234567890',
        displayName: 'Phone User',
        role: 'CUSTOMER',
        avatarUrl: null,
        emailVerified: false,
        phoneVerified: false,
        passwordHash: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-2',
        tokenHash: 'hash',
        userId: 'user-2',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await caller.auth.register({
        phone: '+1234567890',
        password: 'StrongPass123!',
        displayName: 'Phone User',
      });

      expect(result.user.phone).toBe('+1234567890');
    });

    it('should reject registration without email or phone', async () => {
      await expect(
        caller.auth.register({
          password: 'StrongPass123!',
          displayName: 'Test User',
        })
      ).rejects.toThrow('Either email or phone must be provided');
    });

    it('should reject weak password', async () => {
      await expect(
        caller.auth.register({
          email: 'test@example.com',
          password: 'weak',
          displayName: 'Test User',
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate user', async () => {
      const existingUser = {
        id: 'existing-user',
        email: 'existing@example.com',
        phone: null,
        displayName: 'Existing User',
        role: 'CUSTOMER',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(existingUser);

      await expect(
        caller.auth.register({
          email: 'existing@example.com',
          password: 'StrongPass123!',
          displayName: 'Test User',
        })
      ).rejects.toThrow('User already exists');
    });
  });

  describe('login', () => {
    it('should login with valid email and password', async () => {
      const passwordHash = await hashPassword('StrongPass123!');
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        displayName: 'Test User',
        role: 'CUSTOMER',
        avatarUrl: null,
        emailVerified: true,
        phoneVerified: false,
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await caller.auth.login({
        email: 'test@example.com',
        password: 'StrongPass123!',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should login with valid phone and password', async () => {
      const passwordHash = await hashPassword('StrongPass123!');
      const mockUser = {
        id: 'user-2',
        email: null,
        phone: '+1234567890',
        displayName: 'Phone User',
        role: 'CUSTOMER',
        avatarUrl: null,
        emailVerified: false,
        phoneVerified: true,
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-2',
        tokenHash: 'hash',
        userId: 'user-2',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await caller.auth.login({
        phone: '+1234567890',
        password: 'StrongPass123!',
      });

      expect(result.user.phone).toBe('+1234567890');
    });

    it('should reject login with invalid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        caller.auth.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject login with wrong password', async () => {
      const passwordHash = await hashPassword('CorrectPassword123!');
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash,
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        caller.auth.login({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject login without email or phone', async () => {
      await expect(
        caller.auth.login({
          password: 'SomePassword123!',
        })
      ).rejects.toThrow('Either email or phone must be provided');
    });
  });

  describe('refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        displayName: 'Test User',
        role: 'CUSTOMER',
        avatarUrl: null,
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStoredToken = {
        id: 'token-1',
        tokenHash: 'stored-hash',
        userId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      };

      // Create a valid refresh token
      const { signRefreshToken } = require('../../src/utils/jwt');
      const refreshToken = signRefreshToken({
        userId: 'user-1',
        tokenId: 'stored-hash',
      });

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      mockPrisma.refreshToken.update.mockResolvedValue({ ...mockStoredToken, revoked: true });
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'new-token',
        tokenHash: 'new-hash',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await caller.auth.refresh({
        refreshToken,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.refreshToken.update).toHaveBeenCalled(); // Old token revoked
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled(); // New token created
    });

    it('should reject expired refresh token', async () => {
      const mockStoredToken = {
        id: 'token-1',
        tokenHash: 'stored-hash',
        userId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 86400000), // Expired
        createdAt: new Date(),
      };

      const { signRefreshToken } = require('../../src/utils/jwt');
      const refreshToken = signRefreshToken({
        userId: 'user-1',
        tokenId: 'stored-hash',
      });

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);

      await expect(
        caller.auth.refresh({ refreshToken })
      ).rejects.toThrow('Refresh token expired');
    });

    it('should reject revoked refresh token', async () => {
      const mockStoredToken = {
        id: 'token-1',
        tokenHash: 'stored-hash',
        userId: 'user-1',
        revoked: true,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      };

      const { signRefreshToken } = require('../../src/utils/jwt');
      const refreshToken = signRefreshToken({
        userId: 'user-1',
        tokenId: 'stored-hash',
      });

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });

      await expect(
        caller.auth.refresh({ refreshToken })
      ).rejects.toThrow('Token reuse detected');
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        caller.auth.refresh({ refreshToken: 'invalid-token' })
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    let authenticatedCaller: any;

    beforeEach(() => {
      const authCtx = {
        repositories: {
          users: userRepo,
          refreshTokens: refreshTokenRepo,
          passwordResets: passwordResetRepo,
        },
        eventPublisher: mockEventPublisher,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        correlationId: 'test-correlation-id',
        auth: {
          user: {
            userId: 'user-1',
            email: 'test@example.com',
            role: 'CUSTOMER',
          },
        },
      };

      authenticatedCaller = appRouter.createCaller(authCtx);
    });

    it('should logout with refresh token', async () => {
      const { signRefreshToken } = require('../../src/utils/jwt');
      const refreshToken = signRefreshToken({
        userId: 'user-1',
        tokenId: 'token-hash',
      });

      mockPrisma.refreshToken.update.mockResolvedValue({
        id: 'token-1',
        revoked: true,
      });

      const result = await authenticatedCaller.auth.logout({
        refreshToken,
      });

      expect(result.message).toBe('Logged out successfully');
      expect(mockPrisma.refreshToken.update).toHaveBeenCalled();
    });

    it('should logout all sessions', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await authenticatedCaller.auth.logout({
        revokeAll: true,
      });

      expect(result.message).toBe('All sessions logged out');
      expect(result.count).toBe(3);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      });
    });

    it('should reject logout without refreshToken or revokeAll', async () => {
      await expect(
        authenticatedCaller.auth.logout({})
      ).rejects.toThrow('Either refreshToken or revokeAll must be provided');
    });
  });

  describe('requestPasswordReset', () => {
    it('should create password reset token for existing user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        displayName: 'Test User',
        role: 'CUSTOMER',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.passwordReset.create.mockResolvedValue({
        id: 'reset-1',
        tokenHash: 'hash',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        createdAt: new Date(),
      });

      const result = await caller.auth.requestPasswordReset({
        email: 'test@example.com',
      });

      expect(result.message).toContain('password reset link will be sent');
      expect(mockPrisma.passwordReset.create).toHaveBeenCalled();
    });

    it('should return success even for non-existent user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await caller.auth.requestPasswordReset({
        email: 'nonexistent@example.com',
      });

      expect(result.message).toContain('password reset link will be sent');
      expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    });

    it('should reject without email or phone', async () => {
      await expect(
        caller.auth.requestPasswordReset({})
      ).rejects.toThrow('Either email or phone must be provided');
    });
  });

  describe('confirmPasswordReset', () => {
    it('should reset password with valid token', async () => {
      const { generateTokenPair } = require('../../src/utils/token');
      const { token, hash } = generateTokenPair();

      const mockResetToken = {
        id: 'reset-1',
        tokenHash: hash,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        createdAt: new Date(),
      };

      mockPrisma.passwordReset.findUnique.mockResolvedValue(mockResetToken);
      mockPrisma.passwordReset.update.mockResolvedValue({
        ...mockResetToken,
        used: true,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'new-hash',
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      const result = await caller.auth.confirmPasswordReset({
        token,
        newPassword: 'NewStrongPass123!',
      });

      expect(result.message).toContain('Password reset successful');
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.passwordReset.update).toHaveBeenCalled();
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled(); // All tokens revoked
    });

    it('should reject expired reset token', async () => {
      const { generateTokenPair } = require('../../src/utils/token');
      const { token, hash } = generateTokenPair();

      const mockResetToken = {
        id: 'reset-1',
        tokenHash: hash,
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 3600000), // Expired
        used: false,
        createdAt: new Date(),
      };

      mockPrisma.passwordReset.findUnique.mockResolvedValue(mockResetToken);

      await expect(
        caller.auth.confirmPasswordReset({
          token,
          newPassword: 'NewStrongPass123!',
        })
      ).rejects.toThrow('Reset token expired');
    });

    it('should reject already used reset token', async () => {
      const { generateTokenPair } = require('../../src/utils/token');
      const { token, hash } = generateTokenPair();

      const mockResetToken = {
        id: 'reset-1',
        tokenHash: hash,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        used: true,
        createdAt: new Date(),
      };

      mockPrisma.passwordReset.findUnique.mockResolvedValue(mockResetToken);

      await expect(
        caller.auth.confirmPasswordReset({
          token,
          newPassword: 'NewStrongPass123!',
        })
      ).rejects.toThrow('Reset token already used');
    });

    it('should reject weak new password', async () => {
      const { generateTokenPair } = require('../../src/utils/token');
      const { token } = generateTokenPair();

      await expect(
        caller.auth.confirmPasswordReset({
          token,
          newPassword: 'weak',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid reset token', async () => {
      mockPrisma.passwordReset.findUnique.mockResolvedValue(null);

      await expect(
        caller.auth.confirmPasswordReset({
          token: 'invalid-token',
          newPassword: 'NewStrongPass123!',
        })
      ).rejects.toThrow('Invalid or expired reset token');
    });
  });
});
