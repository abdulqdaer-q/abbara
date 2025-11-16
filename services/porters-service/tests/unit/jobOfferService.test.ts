import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JobOfferService } from '../../src/services/jobOfferService';
import { prisma } from '../../src/lib/prisma';
import { OfferStatus, AssignmentStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../../src/lib/kafka');
jest.mock('../../src/lib/metrics');
jest.mock('../../src/lib/correlation');

describe('JobOfferService', () => {
  let jobOfferService: JobOfferService;

  beforeEach(() => {
    jobOfferService = new JobOfferService();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.jobOffer.deleteMany({});
    await prisma.porterProfile.deleteMany({});
  });

  describe('createOffer', () => {
    it('should create a new offer with expiration', async () => {
      // Create test porter
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-1',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          vehicleType: 'SEDAN',
          verificationStatus: 'VERIFIED',
        },
      });

      const offer = await jobOfferService.createOffer(
        'order-1',
        porter.id,
        'test-user-1',
        { test: true }
      );

      expect(offer).toBeDefined();
      expect(offer.orderId).toBe('order-1');
      expect(offer.porterId).toBe(porter.id);
      expect(offer.offerStatus).toBe(OfferStatus.PENDING);
      expect(offer.assignmentStatus).toBe(AssignmentStatus.PENDING);
      expect(offer.expiresAt).toBeDefined();
      expect(offer.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject if porter has too many pending offers', async () => {
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1234567891',
          email: 'jane@example.com',
          vehicleType: 'VAN',
          verificationStatus: 'VERIFIED',
        },
      });

      // Create max concurrent offers
      const maxOffers = parseInt(process.env.MAX_CONCURRENT_OFFERS_PER_PORTER || '3');
      for (let i = 0; i < maxOffers; i++) {
        await prisma.jobOffer.create({
          data: {
            orderId: `order-${i}`,
            porterId: porter.id,
            offerStatus: OfferStatus.PENDING,
            offeredAt: new Date(),
            expiresAt: new Date(Date.now() + 30000),
          },
        });
      }

      // Try to create one more
      await expect(
        jobOfferService.createOffer(`order-${maxOffers}`, porter.id, 'test-user-2')
      ).rejects.toThrow('too many pending offers');
    });
  });

  describe('acceptOffer', () => {
    it('should accept a valid pending offer', async () => {
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-3',
          firstName: 'Mike',
          lastName: 'Johnson',
          phone: '+1234567892',
          email: 'mike@example.com',
          vehicleType: 'TRUCK',
          verificationStatus: 'VERIFIED',
        },
      });

      const offer = await prisma.jobOffer.create({
        data: {
          orderId: 'order-accept-1',
          porterId: porter.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      const result = await jobOfferService.acceptOffer(
        offer.id,
        porter.id,
        'test-user-3',
        'idempotency-key-1'
      );

      expect(result.offerStatus).toBe(OfferStatus.ACCEPTED);
      expect(result.assignmentStatus).toBe(AssignmentStatus.CONFIRMED);
      expect(result.acceptedAt).toBeDefined();
    });

    it('should reject if offer already accepted', async () => {
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-4',
          firstName: 'Sarah',
          lastName: 'Williams',
          phone: '+1234567893',
          email: 'sarah@example.com',
          vehicleType: 'SEDAN',
          verificationStatus: 'VERIFIED',
        },
      });

      const offer = await prisma.jobOffer.create({
        data: {
          orderId: 'order-accept-2',
          porterId: porter.id,
          offerStatus: OfferStatus.ACCEPTED,
          acceptedAt: new Date(),
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      await expect(
        jobOfferService.acceptOffer(offer.id, porter.id, 'test-user-4')
      ).rejects.toThrow('already accepted');
    });

    it('should reject if offer has expired', async () => {
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-5',
          firstName: 'Tom',
          lastName: 'Davis',
          phone: '+1234567894',
          email: 'tom@example.com',
          vehicleType: 'SUV',
          verificationStatus: 'VERIFIED',
        },
      });

      const offer = await prisma.jobOffer.create({
        data: {
          orderId: 'order-accept-3',
          porterId: porter.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      await expect(
        jobOfferService.acceptOffer(offer.id, porter.id, 'test-user-5')
      ).rejects.toThrow('expired');
    });

    it('should use idempotency key to return cached result', async () => {
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-6',
          firstName: 'Emma',
          lastName: 'Brown',
          phone: '+1234567895',
          email: 'emma@example.com',
          vehicleType: 'VAN',
          verificationStatus: 'VERIFIED',
        },
      });

      const offer = await prisma.jobOffer.create({
        data: {
          orderId: 'order-idem-1',
          porterId: porter.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      const idempotencyKey = 'idempotency-test-1';

      // First call
      const result1 = await jobOfferService.acceptOffer(
        offer.id,
        porter.id,
        'test-user-6',
        idempotencyKey
      );

      // Second call with same idempotency key
      const result2 = await jobOfferService.acceptOffer(
        offer.id,
        porter.id,
        'test-user-6',
        idempotencyKey
      );

      // Results should be the same
      expect(result1.id).toBe(result2.id);
      expect(result1.offerStatus).toBe(result2.offerStatus);
    });

    it('should handle concurrent acceptance attempts (race condition)', async () => {
      // This is a unit test, full concurrency test is in integration tests
      const porter1 = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-race-1',
          firstName: 'Race',
          lastName: 'Test1',
          phone: '+1234567896',
          email: 'race1@example.com',
          vehicleType: 'SEDAN',
          verificationStatus: 'VERIFIED',
        },
      });

      const porter2 = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-race-2',
          firstName: 'Race',
          lastName: 'Test2',
          phone: '+1234567897',
          email: 'race2@example.com',
          vehicleType: 'VAN',
          verificationStatus: 'VERIFIED',
        },
      });

      // Create offers for both porters for the same order
      const offer1 = await prisma.jobOffer.create({
        data: {
          orderId: 'order-race-1',
          porterId: porter1.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      const offer2 = await prisma.jobOffer.create({
        data: {
          orderId: 'order-race-1',
          porterId: porter2.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      // Porter 1 accepts first
      await jobOfferService.acceptOffer(
        offer1.id,
        porter1.id,
        'test-user-race-1'
      );

      // Porter 2 tries to accept - should fail because order is already assigned
      await expect(
        jobOfferService.acceptOffer(offer2.id, porter2.id, 'test-user-race-2')
      ).rejects.toThrow('already assigned');
    });

    it('should revoke other pending offers when one is accepted', async () => {
      const porter1 = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-revoke-1',
          firstName: 'Revoke',
          lastName: 'Test1',
          phone: '+1234567898',
          email: 'revoke1@example.com',
          vehicleType: 'SEDAN',
          verificationStatus: 'VERIFIED',
        },
      });

      const porter2 = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-revoke-2',
          firstName: 'Revoke',
          lastName: 'Test2',
          phone: '+1234567899',
          email: 'revoke2@example.com',
          vehicleType: 'VAN',
          verificationStatus: 'VERIFIED',
        },
      });

      // Create offers for both porters
      const offer1 = await prisma.jobOffer.create({
        data: {
          orderId: 'order-revoke-1',
          porterId: porter1.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      const offer2 = await prisma.jobOffer.create({
        data: {
          orderId: 'order-revoke-1',
          porterId: porter2.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      // Porter 1 accepts
      await jobOfferService.acceptOffer(
        offer1.id,
        porter1.id,
        'test-user-revoke-1'
      );

      // Check that offer2 is revoked
      const revokedOffer = await prisma.jobOffer.findUnique({
        where: { id: offer2.id },
      });

      expect(revokedOffer?.offerStatus).toBe(OfferStatus.REVOKED);
    });
  });

  describe('rejectOffer', () => {
    it('should reject a pending offer', async () => {
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-7',
          firstName: 'Chris',
          lastName: 'Wilson',
          phone: '+1234567800',
          email: 'chris@example.com',
          vehicleType: 'MOTORCYCLE',
          verificationStatus: 'VERIFIED',
        },
      });

      const offer = await prisma.jobOffer.create({
        data: {
          orderId: 'order-reject-1',
          porterId: porter.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      const result = await jobOfferService.rejectOffer(
        offer.id,
        porter.id,
        'Too far away'
      );

      expect(result.offerStatus).toBe(OfferStatus.REJECTED);
      expect(result.rejectionReason).toBe('Too far away');
      expect(result.rejectedAt).toBeDefined();
    });

    it('should fail if offer does not belong to porter', async () => {
      const porter1 = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-8',
          firstName: 'Porter',
          lastName: 'One',
          phone: '+1234567801',
          email: 'porter1@example.com',
          vehicleType: 'SEDAN',
          verificationStatus: 'VERIFIED',
        },
      });

      const porter2 = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-9',
          firstName: 'Porter',
          lastName: 'Two',
          phone: '+1234567802',
          email: 'porter2@example.com',
          vehicleType: 'VAN',
          verificationStatus: 'VERIFIED',
        },
      });

      const offer = await prisma.jobOffer.create({
        data: {
          orderId: 'order-reject-2',
          porterId: porter1.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      // Try to reject with wrong porter
      await expect(
        jobOfferService.rejectOffer(offer.id, porter2.id, 'Wrong porter')
      ).rejects.toThrow('does not belong to this porter');
    });
  });

  describe('expireOffers', () => {
    it('should mark expired offers', async () => {
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-10',
          firstName: 'Expire',
          lastName: 'Test',
          phone: '+1234567803',
          email: 'expire@example.com',
          vehicleType: 'BICYCLE',
          verificationStatus: 'VERIFIED',
        },
      });

      // Create expired offer
      await prisma.jobOffer.create({
        data: {
          orderId: 'order-expire-1',
          porterId: porter.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
        },
      });

      // Create non-expired offer
      await prisma.jobOffer.create({
        data: {
          orderId: 'order-expire-2',
          porterId: porter.id,
          offerStatus: OfferStatus.PENDING,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + 30000),
        },
      });

      const count = await jobOfferService.expireOffers();

      expect(count).toBe(1);

      // Verify status changed
      const expiredOffer = await prisma.jobOffer.findFirst({
        where: { orderId: 'order-expire-1' },
      });

      expect(expiredOffer?.offerStatus).toBe(OfferStatus.EXPIRED);
    });
  });

  describe('getPorterOffers', () => {
    it('should get all offers for a porter', async () => {
      const porter = await prisma.porterProfile.create({
        data: {
          userId: 'test-user-11',
          firstName: 'Get',
          lastName: 'Offers',
          phone: '+1234567804',
          email: 'get@example.com',
          vehicleType: 'SEDAN',
          verificationStatus: 'VERIFIED',
        },
      });

      // Create multiple offers
      await prisma.jobOffer.createMany({
        data: [
          {
            orderId: 'order-get-1',
            porterId: porter.id,
            offerStatus: OfferStatus.PENDING,
            offeredAt: new Date(),
            expiresAt: new Date(Date.now() + 30000),
          },
          {
            orderId: 'order-get-2',
            porterId: porter.id,
            offerStatus: OfferStatus.ACCEPTED,
            offeredAt: new Date(),
            expiresAt: new Date(Date.now() + 30000),
          },
          {
            orderId: 'order-get-3',
            porterId: porter.id,
            offerStatus: OfferStatus.REJECTED,
            offeredAt: new Date(),
            expiresAt: new Date(Date.now() + 30000),
          },
        ],
      });

      const allOffers = await jobOfferService.getPorterOffers(porter.id);
      expect(allOffers.length).toBe(3);

      const pendingOffers = await jobOfferService.getPorterOffers(
        porter.id,
        OfferStatus.PENDING
      );
      expect(pendingOffers.length).toBe(1);
      expect(pendingOffers[0].offerStatus).toBe(OfferStatus.PENDING);
    });
  });
});
