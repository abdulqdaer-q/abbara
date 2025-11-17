import { logger } from '../utils/logger';

// Define types since Prisma client may not be generated
type PrismaClient = any;
type User = any;
type UserRole = 'CUSTOMER' | 'PORTER' | 'ADMIN';

export interface CreateUserInput {
  email?: string;
  phone?: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  phone?: string;
  passwordHash?: string;
  displayName?: string;
  avatarUrl?: string;
  role?: UserRole;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<User> {
    logger.debug('Creating user', { email: input.email, phone: input.phone });

    return this.prisma.user.create({
      data: {
        ...input,
        role: input.role || 'CUSTOMER',
      },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by phone
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  /**
   * Find user by email or phone
   */
  async findByEmailOrPhone(email?: string, phone?: string): Promise<User | null> {
    if (!email && !phone) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : {},
          phone ? { phone } : {},
        ].filter(condition => Object.keys(condition).length > 0),
      },
    });
  }

  /**
   * Update user
   */
  async update(id: string, input: UpdateUserInput): Promise<User> {
    logger.debug('Updating user', { userId: id });

    return this.prisma.user.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<User> {
    logger.debug('Deleting user', { userId: id });

    return this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Search users
   */
  async search(query: string, limit: number = 20): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });
  }

  /**
   * List users by role
   */
  async listByRole(role: UserRole, skip: number = 0, take: number = 20): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { role },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }
}
