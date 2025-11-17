import { appRouter } from '../../src/routers';
import { UserRepository } from '../../src/repositories/userRepository';
import { RefreshTokenRepository } from '../../src/repositories/refreshTokenRepository';
import { PasswordResetRepository } from '../../src/repositories/passwordResetRepository';

// Mock dependencies
jest.mock('../../src/utils/logger');

// Mock argon2 to avoid native module issues
jest.mock('argon2', () => ({
  hash: jest.fn((password: string) => Promise.resolve(`hashed-${password}`)),
  verify: jest.fn((hash: string, password: string) => {
    return Promise.resolve(hash === `hashed-${password}`);
  }),
  argon2id: 2,
}));

// Mock Prisma Client types
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
  UserRole: {
    CUSTOMER: 'CUSTOMER',
    PORTER: 'PORTER',
    ADMIN: 'ADMIN',
  },
  VerificationStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
  },
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
} as any;

const mockEventPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
  publishBatch: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

describe('Users Router Integration Tests', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let passwordResetRepo: PasswordResetRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    userRepo = new UserRepository(mockPrisma);
    refreshTokenRepo = new RefreshTokenRepository(mockPrisma);
    passwordResetRepo = new PasswordResetRepository(mockPrisma);
  });

  const createCaller = (authContext?: any) => {
    const ctx = {
      req: {} as any,
      res: {} as any,
      token: null,
      prisma: mockPrisma,
      repositories: {
        users: userRepo,
        refreshTokens: refreshTokenRepo,
        passwordResets: passwordResetRepo,
        porterProfiles: {} as any,
        getPrisma: () => mockPrisma,
      } as any,
      eventPublisher: mockEventPublisher,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      correlationId: 'test-correlation-id',
      ...authContext,
    };

    return appRouter.createCaller(ctx);
  };

  describe('getProfile', () => {
    it('should return authenticated user profile', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        displayName: 'Test User',
        avatarUrl: null,
        role: 'CUSTOMER',
        emailVerified: true,
        phoneVerified: false,
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'user-1',
            email: 'test@example.com',
            role: 'CUSTOMER',
          },
        },
      });

      const result = await caller.users.getProfile();

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('Test User');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'nonexistent-user',
            email: 'test@example.com',
            role: 'CUSTOMER',
          },
        },
      });

      await expect(caller.users.getProfile()).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        displayName: 'Test User',
        avatarUrl: null,
        role: 'CUSTOMER',
        emailVerified: true,
        phoneVerified: false,
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser = {
        ...existingUser,
        displayName: 'Updated Name',
        updatedAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'user-1',
            email: 'test@example.com',
            role: 'CUSTOMER',
          },
        },
      });

      const result = await caller.users.updateProfile({
        displayName: 'Updated Name',
      });

      expect(result.displayName).toBe('Updated Name');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UserUpdated',
        })
      );
    });

    it('should reject duplicate email', async () => {
      const otherUser = {
        id: 'user-2',
        email: 'other@example.com',
        displayName: 'Other User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(otherUser);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'user-1',
            email: 'test@example.com',
            role: 'CUSTOMER',
          },
        },
      });

      await expect(
        caller.users.updateProfile({
          email: 'other@example.com',
        })
      ).rejects.toThrow('Email already in use');
    });

    it('should reject duplicate phone', async () => {
      const otherUser = {
        id: 'user-2',
        phone: '+9876543210',
        displayName: 'Other User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(otherUser);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'user-1',
            email: 'test@example.com',
            role: 'CUSTOMER',
          },
        },
      });

      await expect(
        caller.users.updateProfile({
          phone: '+9876543210',
        })
      ).rejects.toThrow('Phone number already in use');
    });

    it('should reset email verification when email changes', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'old@example.com',
        emailVerified: true,
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser = {
        ...existingUser,
        email: 'new@example.com',
        emailVerified: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(null); // No conflict
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'user-1',
            email: 'old@example.com',
            role: 'CUSTOMER',
          },
        },
      });

      const result = await caller.users.updateProfile({
        email: 'new@example.com',
      });

      expect(result.emailVerified).toBe(false);
    });
  });

  describe('getPublicProfile', () => {
    it('should return public user profile', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'CUSTOMER',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const caller = createCaller();

      const result = await caller.users.getPublicProfile({
        userId: 'user-1',
      });

      expect(result.id).toBe('user-1');
      expect(result.displayName).toBe('Test User');
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.role).toBe('CUSTOMER');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const caller = createCaller();

      await expect(
        caller.users.getPublicProfile({
          userId: 'nonexistent-user',
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('search', () => {
    it('should search users as authenticated user', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'john@example.com',
          phone: null,
          displayName: 'John Doe',
          avatarUrl: null,
          role: 'CUSTOMER',
          emailVerified: true,
          phoneVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-2',
          email: 'jane@example.com',
          phone: null,
          displayName: 'Jane Doe',
          avatarUrl: null,
          role: 'CUSTOMER',
          emailVerified: true,
          phoneVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'user-1',
            email: 'john@example.com',
            role: 'CUSTOMER',
          },
        },
      });

      const result = await caller.users.search({
        query: 'doe',
        limit: 10,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('email'); // Non-admin shouldn't see emails
      expect(result[0]).not.toHaveProperty('phone');
      expect(result[0]).toHaveProperty('displayName');
    });

    it('should search users as admin with full details', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'john@example.com',
          phone: '+1234567890',
          displayName: 'John Doe',
          avatarUrl: null,
          role: 'CUSTOMER',
          emailVerified: true,
          phoneVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
          },
        },
      });

      const result = await caller.users.search({
        query: 'john',
        limit: 20,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('phone');
      expect(result[0]).toHaveProperty('emailVerified');
    });

    it('should limit results for non-admin users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'user-1',
            email: 'test@example.com',
            role: 'CUSTOMER',
          },
        },
      });

      await caller.users.search({
        query: 'test',
        limit: 50,
      });

      // Non-admin should be limited to 10 results max
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe('getUserById - Admin Only', () => {
    it('should allow admin to get user by ID', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: '+1234567890',
        displayName: 'Test User',
        avatarUrl: null,
        role: 'CUSTOMER',
        emailVerified: true,
        phoneVerified: true,
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
          },
        },
      });

      const result = await caller.users.getUserById({
        userId: 'user-1',
      });

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
          },
        },
      });

      await expect(
        caller.users.getUserById({
          userId: 'nonexistent-user',
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('updateRole - Admin Only', () => {
    it('should allow admin to update user role', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser = {
        ...existingUser,
        role: 'PORTER',
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
          },
        },
      });

      const result = await caller.users.updateRole({
        userId: 'user-1',
        role: 'PORTER',
      });

      expect(result.role).toBe('PORTER');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UserUpdated',
        })
      );
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
          },
        },
      });

      await expect(
        caller.users.updateRole({
          userId: 'nonexistent-user',
          role: 'PORTER',
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('listByRole - Admin Only', () => {
    it('should allow admin to list users by role', async () => {
      const mockUsers = [
        {
          id: 'porter-1',
          email: 'porter1@example.com',
          phone: null,
          displayName: 'Porter One',
          avatarUrl: null,
          role: 'PORTER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'porter-2',
          email: 'porter2@example.com',
          phone: null,
          displayName: 'Porter Two',
          avatarUrl: null,
          role: 'PORTER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
          },
        },
      });

      const result = await caller.users.listByRole({
        role: 'PORTER',
        skip: 0,
        take: 20,
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('PORTER');
      expect(result[1].role).toBe('PORTER');
    });

    it('should support pagination', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const caller = createCaller({
        auth: {
          user: {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: 'ADMIN',
          },
        },
      });

      await caller.users.listByRole({
        role: 'CUSTOMER',
        skip: 10,
        take: 5,
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        })
      );
    });
  });
});
