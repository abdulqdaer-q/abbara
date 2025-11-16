import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { prisma } from '../../src/lib/prisma';
import jobOfferService from '../../src/services/jobOfferService';
import { OfferStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../../src/lib/kafka');
jest.mock('../../src/lib/metrics');
jest.mock('../../src/lib/correlation');

/**
 * Integration tests for race condition handling
 * Simulates concurrent job acceptance attempts
 */

describe('Race Condition Tests', () => {
  beforeAll(async () => {
    // Setup can go here if needed
  });

  afterAll(async () => {
    // Cleanup
    await prisma.jobOffer.deleteMany({});
    await prisma.porterProfile.deleteMany({});
  });

  it('should handle concurrent acceptJob calls - only one succeeds', async () => {
    // Create 3 porters who will compete for the same order
    const porters = await Promise.all([
      prisma.porterProfile.create({
        data: {
          userId: 'race-user-1',
          firstName: 'Concurrent',
          lastName: 'One',
          phone: '+1111111111',
          email: 'concurrent1@test.com',
          vehicleType: 'SEDAN',
          verificationStatus: 'VERIFIED',
        },
      }),
      prisma.porterProfile.create({
        data: {
          userId: 'race-user-2',
          firstName: 'Concurrent',
          lastName: 'Two',
          phone: '+1111111112',
          email: 'concurrent2@test.com',
          vehicleType: 'VAN',
          verificationStatus: 'VERIFIED',
        },
      }),
      prisma.porterProfile.create({
        data: {
          userId: 'race-user-3',
          firstName: 'Concurrent',
          lastName: 'Three',
          phone: '+1111111113',
          email: 'concurrent3@test.com',
          vehicleType: 'TRUCK',
          verificationStatus: 'VERIFIED',
        },
      }),
    ]);

    // Create offers for all porters for the same order
    const offers = await Promise.all(
      porters.map((porter) =>
        prisma.jobOffer.create({
          data: {
            orderId: 'concurrent-order-1',
            porterId: porter.id,
            offerStatus: OfferStatus.PENDING,
            offeredAt: new Date(),
            expiresAt: new Date(Date.now() + 30000),
          },
        })
      )
    );

    // Simulate concurrent acceptance attempts
    const acceptancePromises = offers.map((offer, idx) =>
      jobOfferService.acceptOffer(
        offer.id,
        porters[idx].id,
        `race-user-${idx + 1}`,
        `concurrent-idem-${idx}`
      ).catch((error) => ({ error }))
    );

    const results = await Promise.all(acceptancePromises);

    // Count successes and failures
    const successes = results.filter((r) => !('error' in r));
    const failures = results.filter((r) => 'error' in r);

    // Exactly ONE should succeed
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);

    // The failures should be because order was already assigned
    failures.forEach((failure: any) => {
      expect(failure.error.message).toMatch(/already assigned|already accepted/i);
    });

    // Verify that the other offers were revoked
    const allOffers = await prisma.jobOffer.findMany({
      where: { orderId: 'concurrent-order-1' },
    });

    const revokedCount = allOffers.filter((o) => o.offerStatus === OfferStatus.REVOKED).length;
    const acceptedCount = allOffers.filter((o) => o.offerStatus === OfferStatus.ACCEPTED).length;

    expect(acceptedCount).toBe(1);
    expect(revokedCount).toBe(2);
  });

  it('should handle accept after expiry', async () => {
    const porter = await prisma.porterProfile.create({
      data: {
        userId: 'expiry-user-1',
        firstName: 'Expiry',
        lastName: 'Test',
        phone: '+1222222222',
        email: 'expiry@test.com',
        vehicleType: 'SUV',
        verificationStatus: 'VERIFIED',
      },
    });

    // Create offer that expires immediately
    const offer = await prisma.jobOffer.create({
      data: {
        orderId: 'expiry-order-1',
        porterId: porter.id,
        offerStatus: OfferStatus.PENDING,
        offeredAt: new Date(Date.now() - 5000),
        expiresAt: new Date(Date.now() + 100), // Expires in 100ms
      },
    });

    // Wait for offer to expire
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Try to accept expired offer
    await expect(
      jobOfferService.acceptOffer(offer.id, porter.id, 'expiry-user-1')
    ).rejects.toThrow(/expired/i);

    // Verify offer status changed to EXPIRED
    const expiredOffer = await prisma.jobOffer.findUnique({
      where: { id: offer.id },
    });

    expect(expiredOffer?.offerStatus).toBe(OfferStatus.EXPIRED);
  });

  it('should revoke other pending offers when one is accepted', async () => {
    // Create 5 porters
    const porters = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.porterProfile.create({
          data: {
            userId: `revoke-user-${i}`,
            firstName: 'Revoke',
            lastName: `Test${i}`,
            phone: `+133333333${i}`,
            email: `revoke${i}@test.com`,
            vehicleType: 'SEDAN',
            verificationStatus: 'VERIFIED',
          },
        })
      )
    );

    const orderId = 'revoke-order-1';

    // Create offers for all porters
    const offers = await Promise.all(
      porters.map((porter) =>
        prisma.jobOffer.create({
          data: {
            orderId,
            porterId: porter.id,
            offerStatus: OfferStatus.PENDING,
            offeredAt: new Date(),
            expiresAt: new Date(Date.now() + 30000),
          },
        })
      )
    );

    // Porter 0 accepts
    await jobOfferService.acceptOffer(
      offers[0].id,
      porters[0].id,
      'revoke-user-0'
    );

    // Check all offers for this order
    const allOffers = await prisma.jobOffer.findMany({
      where: { orderId },
    });

    expect(allOffers.length).toBe(5);

    // One accepted
    const accepted = allOffers.filter((o) => o.offerStatus === OfferStatus.ACCEPTED);
    expect(accepted.length).toBe(1);
    expect(accepted[0].porterId).toBe(porters[0].id);

    // Four revoked
    const revoked = allOffers.filter((o) => o.offerStatus === OfferStatus.REVOKED);
    expect(revoked.length).toBe(4);
  });

  it('should handle truly concurrent acceptance (stress test)', async () => {
    // Create 10 porters
    const porters = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        prisma.porterProfile.create({
          data: {
            userId: `stress-user-${i}`,
            firstName: 'Stress',
            lastName: `Test${i}`,
            phone: `+144444444${i}`,
            email: `stress${i}@test.com`,
            vehicleType: 'SEDAN',
            verificationStatus: 'VERIFIED',
          },
        })
      )
    );

    const orderId = 'stress-order-1';

    // Create offers for all porters
    const offers = await Promise.all(
      porters.map((porter) =>
        prisma.jobOffer.create({
          data: {
            orderId,
            porterId: porter.id,
            offerStatus: OfferStatus.PENDING,
            offeredAt: new Date(),
            expiresAt: new Date(Date.now() + 30000),
          },
        })
      )
    );

    // All porters try to accept at the exact same time
    const acceptPromises = offers.map((offer, idx) =>
      jobOfferService.acceptOffer(
        offer.id,
        porters[idx].id,
        `stress-user-${idx}`,
        `stress-idem-${idx}`
      ).catch((error) => ({ error }))
    );

    const results = await Promise.all(acceptPromises);

    // Exactly ONE should succeed
    const successes = results.filter((r) => !('error' in r));
    const failures = results.filter((r) => 'error' in r);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(9);
  });

  it('should handle idempotent acceptance during race', async () => {
    const porter = await prisma.porterProfile.create({
      data: {
        userId: 'idem-race-user-1',
        firstName: 'IdemRace',
        lastName: 'Test',
        phone: '+1555555555',
        email: 'idemrace@test.com',
        vehicleType: 'VAN',
        verificationStatus: 'VERIFIED',
      },
    });

    const offer = await prisma.jobOffer.create({
      data: {
        orderId: 'idem-race-order-1',
        porterId: porter.id,
        offerStatus: OfferStatus.PENDING,
        offeredAt: new Date(),
        expiresAt: new Date(Date.now() + 30000),
      },
    });

    const idempotencyKey = 'idem-race-key-1';

    // Try to accept the same offer multiple times with same idempotency key
    // (simulating network retries)
    const results = await Promise.all([
      jobOfferService.acceptOffer(offer.id, porter.id, 'idem-race-user-1', idempotencyKey),
      jobOfferService.acceptOffer(offer.id, porter.id, 'idem-race-user-1', idempotencyKey),
      jobOfferService.acceptOffer(offer.id, porter.id, 'idem-race-user-1', idempotencyKey),
    ]);

    // All should return the same result (idempotent)
    expect(results[0].id).toBe(results[1].id);
    expect(results[0].id).toBe(results[2].id);
    expect(results[0].offerStatus).toBe(OfferStatus.ACCEPTED);

    // Only one record should be created in database
    const acceptedOffers = await prisma.jobOffer.findMany({
      where: {
        orderId: 'idem-race-order-1',
        offerStatus: OfferStatus.ACCEPTED,
      },
    });

    expect(acceptedOffers.length).toBe(1);
  });

  it('should prevent double assignment to different porters', async () => {
    const porter1 = await prisma.porterProfile.create({
      data: {
        userId: 'double-user-1',
        firstName: 'Double',
        lastName: 'One',
        phone: '+1666666661',
        email: 'double1@test.com',
        vehicleType: 'SEDAN',
        verificationStatus: 'VERIFIED',
      },
    });

    const porter2 = await prisma.porterProfile.create({
      data: {
        userId: 'double-user-2',
        firstName: 'Double',
        lastName: 'Two',
        phone: '+1666666662',
        email: 'double2@test.com',
        vehicleType: 'VAN',
        verificationStatus: 'VERIFIED',
      },
    });

    const orderId = 'double-assign-order-1';

    const offer1 = await prisma.jobOffer.create({
      data: {
        orderId,
        porterId: porter1.id,
        offerStatus: OfferStatus.PENDING,
        offeredAt: new Date(),
        expiresAt: new Date(Date.now() + 30000),
      },
    });

    const offer2 = await prisma.jobOffer.create({
      data: {
        orderId,
        porterId: porter2.id,
        offerStatus: OfferStatus.PENDING,
        offeredAt: new Date(),
        expiresAt: new Date(Date.now() + 30000),
      },
    });

    // Porter 1 accepts
    await jobOfferService.acceptOffer(offer1.id, porter1.id, 'double-user-1');

    // Porter 2 tries to accept - should fail
    await expect(
      jobOfferService.acceptOffer(offer2.id, porter2.id, 'double-user-2')
    ).rejects.toThrow(/already assigned/i);

    // Verify only porter1 has confirmed assignment
    const offer1Final = await prisma.jobOffer.findUnique({ where: { id: offer1.id } });
    const offer2Final = await prisma.jobOffer.findUnique({ where: { id: offer2.id } });

    expect(offer1Final?.offerStatus).toBe(OfferStatus.ACCEPTED);
    expect(offer2Final?.offerStatus).toBe(OfferStatus.REVOKED);
  });
});
