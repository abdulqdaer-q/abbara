import { EarningsService } from '../../src/services/earningsService';
import { prisma } from '../../src/lib/prisma';
import { EarningType, EarningStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    porterEarnings: {
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      update: jest.fn(),
    },
    porterProfile: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/lib/metrics', () => ({
  recordEarning: jest.fn(),
}));

jest.mock('../../src/lib/logger');

describe('EarningsService Tests', () => {
  let earningsService: EarningsService;

  beforeEach(() => {
    jest.clearAllMocks();
    earningsService = new EarningsService();
  });

  describe('recordEarnings', () => {
    it('should record earnings for a porter', async () => {
      const mockEarning = {
        id: 'earning-1',
        porterId: 'porter-1',
        type: EarningType.DELIVERY_FEE,
        amountCents: BigInt(5000),
        orderId: 'order-1',
        status: EarningStatus.PENDING,
        description: 'Delivery fee',
        createdAt: new Date(),
      };

      (prisma.porterEarnings.create as jest.Mock).mockResolvedValue(mockEarning);
      (prisma.porterProfile.update as jest.Mock).mockResolvedValue({
        id: 'porter-1',
        totalEarningsCents: BigInt(5000),
      });

      const result = await earningsService.recordEarnings(
        'porter-1',
        EarningType.DELIVERY_FEE,
        BigInt(5000),
        'order-1',
        'Delivery fee'
      );

      expect(result).toEqual(mockEarning);
      expect(prisma.porterEarnings.create).toHaveBeenCalledWith({
        data: {
          porterId: 'porter-1',
          type: EarningType.DELIVERY_FEE,
          amountCents: BigInt(5000),
          orderId: 'order-1',
          status: EarningStatus.PENDING,
          description: 'Delivery fee',
          metadata: undefined,
        },
      });
      expect(prisma.porterProfile.update).toHaveBeenCalledWith({
        where: { id: 'porter-1' },
        data: {
          totalEarningsCents: {
            increment: BigInt(5000),
          },
        },
      });
    });

    it('should record earnings with metadata', async () => {
      const mockEarning = {
        id: 'earning-2',
        porterId: 'porter-1',
        type: EarningType.TIP,
        amountCents: BigInt(1000),
        status: EarningStatus.PENDING,
        metadata: { customerTip: true },
        createdAt: new Date(),
      };

      (prisma.porterEarnings.create as jest.Mock).mockResolvedValue(mockEarning);
      (prisma.porterProfile.update as jest.Mock).mockResolvedValue({});

      await earningsService.recordEarnings(
        'porter-1',
        EarningType.TIP,
        BigInt(1000),
        undefined,
        undefined,
        { customerTip: true }
      );

      expect(prisma.porterEarnings.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { customerTip: true },
        }),
      });
    });

    it('should record different earning types', async () => {
      const types = [
        EarningType.DELIVERY_FEE,
        EarningType.TIP,
        EarningType.BONUS,
        EarningType.ADJUSTMENT,
      ];

      for (const type of types) {
        (prisma.porterEarnings.create as jest.Mock).mockResolvedValue({
          id: `earning-${type}`,
          porterId: 'porter-1',
          type,
          amountCents: BigInt(1000),
          status: EarningStatus.PENDING,
        });
        (prisma.porterProfile.update as jest.Mock).mockResolvedValue({});

        await earningsService.recordEarnings('porter-1', type, BigInt(1000));

        expect(prisma.porterEarnings.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type,
            }),
          })
        );
      }
    });
  });

  describe('getEarningsSummary', () => {
    it('should get earnings summary for a porter', async () => {
      (prisma.porterEarnings.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(10000) } }) // total
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(3000) } }) // pending
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(7000) } }); // confirmed

      const result = await earningsService.getEarningsSummary('porter-1');

      expect(result).toEqual({
        totalEarningsCents: BigInt(10000),
        pendingEarningsCents: BigInt(3000),
        confirmedEarningsCents: BigInt(7000),
      });
      expect(prisma.porterEarnings.aggregate).toHaveBeenCalledTimes(3);
    });

    it('should handle porter with no earnings', async () => {
      (prisma.porterEarnings.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amountCents: null } })
        .mockResolvedValueOnce({ _sum: { amountCents: null } })
        .mockResolvedValueOnce({ _sum: { amountCents: null } });

      const result = await earningsService.getEarningsSummary('porter-new');

      expect(result).toEqual({
        totalEarningsCents: BigInt(0),
        pendingEarningsCents: BigInt(0),
        confirmedEarningsCents: BigInt(0),
      });
    });

    it('should calculate correct aggregates by status', async () => {
      (prisma.porterEarnings.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(15000) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(5000) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(10000) } });

      await earningsService.getEarningsSummary('porter-1');

      // Verify correct where clauses
      expect(prisma.porterEarnings.aggregate).toHaveBeenNthCalledWith(1, {
        where: { porterId: 'porter-1' },
        _sum: { amountCents: true },
      });
      expect(prisma.porterEarnings.aggregate).toHaveBeenNthCalledWith(2, {
        where: { porterId: 'porter-1', status: EarningStatus.PENDING },
        _sum: { amountCents: true },
      });
      expect(prisma.porterEarnings.aggregate).toHaveBeenNthCalledWith(3, {
        where: { porterId: 'porter-1', status: EarningStatus.CONFIRMED },
        _sum: { amountCents: true },
      });
    });
  });

  describe('getRecentEarnings', () => {
    it('should get recent earnings with default limit', async () => {
      const mockEarnings = [
        {
          id: 'earning-1',
          porterId: 'porter-1',
          type: EarningType.DELIVERY_FEE,
          amountCents: BigInt(5000),
          createdAt: new Date(),
        },
        {
          id: 'earning-2',
          porterId: 'porter-1',
          type: EarningType.TIP,
          amountCents: BigInt(1000),
          createdAt: new Date(),
        },
      ];

      (prisma.porterEarnings.findMany as jest.Mock).mockResolvedValue(mockEarnings);

      const result = await earningsService.getRecentEarnings('porter-1');

      expect(result).toEqual(mockEarnings);
      expect(prisma.porterEarnings.findMany).toHaveBeenCalledWith({
        where: { porterId: 'porter-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    it('should respect custom limit', async () => {
      (prisma.porterEarnings.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getRecentEarnings('porter-1', 50);

      expect(prisma.porterEarnings.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it('should return empty array for porter with no earnings', async () => {
      (prisma.porterEarnings.findMany as jest.Mock).mockResolvedValue([]);

      const result = await earningsService.getRecentEarnings('porter-new');

      expect(result).toEqual([]);
    });
  });

  describe('getOrderEarnings', () => {
    it('should get earnings for a specific order', async () => {
      const mockEarnings = [
        {
          id: 'earning-1',
          orderId: 'order-1',
          porterId: 'porter-1',
          type: EarningType.DELIVERY_FEE,
          amountCents: BigInt(5000),
        },
        {
          id: 'earning-2',
          orderId: 'order-1',
          porterId: 'porter-1',
          type: EarningType.TIP,
          amountCents: BigInt(1000),
        },
      ];

      (prisma.porterEarnings.findMany as jest.Mock).mockResolvedValue(mockEarnings);

      const result = await earningsService.getOrderEarnings('order-1');

      expect(result).toEqual(mockEarnings);
      expect(prisma.porterEarnings.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
      });
    });

    it('should return empty array for order with no earnings', async () => {
      (prisma.porterEarnings.findMany as jest.Mock).mockResolvedValue([]);

      const result = await earningsService.getOrderEarnings('order-no-earnings');

      expect(result).toEqual([]);
    });
  });

  describe('updateEarningStatus', () => {
    it('should update earning status to CONFIRMED', async () => {
      const mockUpdatedEarning = {
        id: 'earning-1',
        status: EarningStatus.CONFIRMED,
      };

      (prisma.porterEarnings.update as jest.Mock).mockResolvedValue(mockUpdatedEarning);

      const result = await earningsService.updateEarningStatus(
        'earning-1',
        EarningStatus.CONFIRMED
      );

      expect(result).toEqual(mockUpdatedEarning);
      expect(prisma.porterEarnings.update).toHaveBeenCalledWith({
        where: { id: 'earning-1' },
        data: {
          status: EarningStatus.CONFIRMED,
        },
      });
    });

    it('should update earning status to PAID_OUT with payout details', async () => {
      const mockUpdatedEarning = {
        id: 'earning-1',
        status: EarningStatus.PAID_OUT,
        payoutId: 'payout-1',
        payoutStatus: 'completed',
        payoutAt: new Date(),
      };

      (prisma.porterEarnings.update as jest.Mock).mockResolvedValue(mockUpdatedEarning);

      const result = await earningsService.updateEarningStatus(
        'earning-1',
        EarningStatus.PAID_OUT,
        'payout-1',
        'completed'
      );

      expect(result).toEqual(mockUpdatedEarning);
      expect(prisma.porterEarnings.update).toHaveBeenCalledWith({
        where: { id: 'earning-1' },
        data: expect.objectContaining({
          status: EarningStatus.PAID_OUT,
          payoutId: 'payout-1',
          payoutStatus: 'completed',
          payoutAt: expect.any(Date),
        }),
      });
    });

    it('should update status without payout details', async () => {
      const mockUpdatedEarning = {
        id: 'earning-1',
        status: EarningStatus.CANCELLED,
      };

      (prisma.porterEarnings.update as jest.Mock).mockResolvedValue(mockUpdatedEarning);

      await earningsService.updateEarningStatus('earning-1', EarningStatus.CANCELLED);

      expect(prisma.porterEarnings.update).toHaveBeenCalledWith({
        where: { id: 'earning-1' },
        data: {
          status: EarningStatus.CANCELLED,
        },
      });
    });
  });

  describe('requestWithdrawal', () => {
    it('should process withdrawal request with sufficient balance', async () => {
      (prisma.porterEarnings.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(10000) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(0) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(10000) } });

      const mockWithdrawal = {
        id: 'withdrawal-1',
        porterId: 'porter-1',
        type: EarningType.ADJUSTMENT,
        amountCents: BigInt(-5000),
        status: EarningStatus.PENDING,
        description: 'Withdrawal request',
      };

      (prisma.porterEarnings.create as jest.Mock).mockResolvedValue(mockWithdrawal);

      const result = await earningsService.requestWithdrawal(
        'porter-1',
        BigInt(5000),
        'idempotency-key-1'
      );

      expect(result).toEqual(mockWithdrawal);
      expect(prisma.porterEarnings.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          porterId: 'porter-1',
          type: EarningType.ADJUSTMENT,
          amountCents: BigInt(-5000),
          status: EarningStatus.PENDING,
          description: 'Withdrawal request',
          metadata: expect.objectContaining({
            withdrawalRequest: true,
            idempotencyKey: 'idempotency-key-1',
          }),
        }),
      });
    });

    it('should reject withdrawal with insufficient balance', async () => {
      (prisma.porterEarnings.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(5000) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(2000) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(3000) } });

      await expect(
        earningsService.requestWithdrawal('porter-1', BigInt(5000))
      ).rejects.toThrow('Insufficient confirmed earnings for withdrawal');

      expect(prisma.porterEarnings.create).not.toHaveBeenCalled();
    });

    it('should handle withdrawal of full confirmed balance', async () => {
      (prisma.porterEarnings.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(10000) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(0) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(10000) } });

      (prisma.porterEarnings.create as jest.Mock).mockResolvedValue({
        id: 'withdrawal-1',
        amountCents: BigInt(-10000),
      });

      const result = await earningsService.requestWithdrawal('porter-1', BigInt(10000));

      expect(result).toBeDefined();
      expect(prisma.porterEarnings.create).toHaveBeenCalled();
    });

    it('should reject withdrawal when amount exceeds confirmed balance', async () => {
      (prisma.porterEarnings.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(10000) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(5000) } })
        .mockResolvedValueOnce({ _sum: { amountCents: BigInt(5000) } });

      await expect(
        earningsService.requestWithdrawal('porter-1', BigInt(6000))
      ).rejects.toThrow('Insufficient confirmed earnings');
    });
  });
});
