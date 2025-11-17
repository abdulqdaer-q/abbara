import { PrismaClient, PorterProfile, VerificationStatus } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CreatePorterProfileInput {
  userId: string;
  documentsMetadata?: any;
}

export interface UpdatePorterProfileInput {
  verificationStatus?: VerificationStatus;
  documentsMetadata?: any;
  rating?: number;
  totalRatings?: number;
  verificationRequestedAt?: Date;
  verifiedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

export class PorterProfileRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a porter profile
   */
  async create(input: CreatePorterProfileInput): Promise<PorterProfile> {
    logger.debug('Creating porter profile', { userId: input.userId });

    return this.prisma.porterProfile.create({
      data: input,
    });
  }

  /**
   * Find porter profile by user ID
   */
  async findByUserId(userId: string): Promise<PorterProfile | null> {
    return this.prisma.porterProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  /**
   * Find porter profile by ID
   */
  async findById(id: string): Promise<PorterProfile | null> {
    return this.prisma.porterProfile.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  /**
   * Update porter profile
   */
  async update(userId: string, input: UpdatePorterProfileInput): Promise<PorterProfile> {
    logger.debug('Updating porter profile', { userId });

    return this.prisma.porterProfile.update({
      where: { userId },
      data: input,
    });
  }

  /**
   * List porter profiles by verification status
   */
  async listByStatus(
    status: VerificationStatus,
    skip: number = 0,
    take: number = 20
  ) {
    return this.prisma.porterProfile.findMany({
      where: { verificationStatus: status },
      include: { user: true },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update verification status
   */
  async updateVerificationStatus(
    userId: string,
    status: VerificationStatus,
    rejectionReason?: string
  ): Promise<PorterProfile> {
    logger.debug('Updating verification status', { userId, status });

    const data: UpdatePorterProfileInput = {
      verificationStatus: status,
    };

    if (status === 'VERIFIED') {
      data.verifiedAt = new Date();
    } else if (status === 'REJECTED') {
      data.rejectedAt = new Date();
      data.rejectionReason = rejectionReason;
    }

    return this.update(userId, data);
  }

  /**
   * Update porter rating
   */
  async updateRating(userId: string, newRating: number): Promise<PorterProfile> {
    logger.debug('Updating porter rating', { userId, newRating });

    const profile = await this.findByUserId(userId);

    if (!profile) {
      throw new Error('Porter profile not found');
    }

    const totalRatings = profile.totalRatings + 1;
    const rating = ((profile.rating * profile.totalRatings) + newRating) / totalRatings;

    return this.update(userId, {
      rating,
      totalRatings,
    });
  }

  /**
   * Search verified porters
   */
  async searchVerified(
    skip: number = 0,
    take: number = 20,
    minRating?: number
  ) {
    return this.prisma.porterProfile.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        ...(minRating ? { rating: { gte: minRating } } : {}),
      },
      include: { user: true },
      skip,
      take,
      orderBy: { rating: 'desc' },
    });
  }
}
