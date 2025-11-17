import { UserRepository } from '../../src/repositories/userRepository';

// Mock logger
jest.mock('../../src/utils/logger');

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
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as any;

describe('UserRepository Unit Tests', () => {
  let repository: UserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new UserRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create a user with all fields', async () => {
      const input = {
        email: 'test@example.com',
        phone: '+1234567890',
        passwordHash: 'hashed-password',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'CUSTOMER' as const,
      };

      const mockUser = {
        id: 'user-1',
        ...input,
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await repository.create(input);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: input,
      });
    });

    it('should create a user with default role CUSTOMER', async () => {
      const input = {
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        displayName: 'Test User',
      };

      const mockUser = {
        id: 'user-1',
        ...input,
        role: 'CUSTOMER',
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      await repository.create(input);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          ...input,
          role: 'CUSTOMER',
        },
      });
    });

    it('should create a user with only email', async () => {
      const input = {
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        displayName: 'Test User',
      };

      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        ...input,
        phone: null,
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.create(input);

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
    });

    it('should create a user with only phone', async () => {
      const input = {
        phone: '+1234567890',
        passwordHash: 'hashed-password',
        displayName: 'Test User',
      };

      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        ...input,
        email: null,
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.create(input);

      expect(result).toBeDefined();
      expect(result.phone).toBe('+1234567890');
    });
  });

  describe('findById', () => {
    it('should find a user by ID', async () => {
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

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByPhone', () => {
    it('should find a user by phone', async () => {
      const mockUser = {
        id: 'user-1',
        phone: '+1234567890',
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByPhone('+1234567890');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '+1234567890' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByPhone('+9999999999');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailOrPhone', () => {
    it('should find a user by email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await repository.findByEmailOrPhone('test@example.com', undefined);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findFirst).toHaveBeenCalled();
    });

    it('should find a user by phone', async () => {
      const mockUser = {
        id: 'user-1',
        email: null,
        phone: '+1234567890',
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await repository.findByEmailOrPhone(undefined, '+1234567890');

      expect(result).toEqual(mockUser);
    });

    it('should find a user by either email or phone', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        phone: '+1234567890',
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await repository.findByEmailOrPhone('test@example.com', '+1234567890');

      expect(result).toEqual(mockUser);
    });

    it('should return null if neither email nor phone provided', async () => {
      const result = await repository.findByEmailOrPhone(undefined, undefined);

      expect(result).toBeNull();
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await repository.findByEmailOrPhone('nonexistent@example.com', '+9999999999');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateInput = {
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };

      const mockUpdatedUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await repository.update('user-1', updateInput);

      expect(result).toEqual(mockUpdatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateInput,
      });
    });

    it('should update user password', async () => {
      const updateInput = {
        passwordHash: 'new-hashed-password',
      };

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'new-hashed-password',
        updatedAt: new Date(),
      });

      await repository.update('user-1', updateInput);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateInput,
      });
    });

    it('should update user role', async () => {
      const updateInput = {
        role: 'PORTER' as const,
      };

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        role: 'PORTER',
        updatedAt: new Date(),
      });

      await repository.update('user-1', updateInput);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateInput,
      });
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      const mockDeletedUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.delete.mockResolvedValue(mockDeletedUser);

      const result = await repository.delete('user-1');

      expect(result).toEqual(mockDeletedUser);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });
  });

  describe('search', () => {
    it('should search users by query', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'john@example.com',
          displayName: 'John Doe',
          role: 'CUSTOMER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-2',
          email: 'jane@example.com',
          displayName: 'Jane Doe',
          role: 'CUSTOMER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await repository.search('doe', 20);

      expect(result).toEqual(mockUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'doe', mode: 'insensitive' } },
            { phone: { contains: 'doe' } },
            { displayName: { contains: 'doe', mode: 'insensitive' } },
          ],
        },
        take: 20,
      });
    });

    it('should use default limit', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await repository.search('test');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });

    it('should respect custom limit', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await repository.search('test', 5);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });

    it('should return empty array if no users found', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await repository.search('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('listByRole', () => {
    it('should list users by role', async () => {
      const mockUsers = [
        {
          id: 'porter-1',
          email: 'porter1@example.com',
          displayName: 'Porter One',
          role: 'PORTER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'porter-2',
          email: 'porter2@example.com',
          displayName: 'Porter Two',
          role: 'PORTER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await repository.listByRole('PORTER', 0, 20);

      expect(result).toEqual(mockUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'PORTER' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should support pagination', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await repository.listByRole('CUSTOMER', 10, 5);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'CUSTOMER' },
        skip: 10,
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should use default pagination values', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await repository.listByRole('ADMIN');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'ADMIN' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array if no users with role found', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await repository.listByRole('ADMIN');

      expect(result).toEqual([]);
    });
  });
});
