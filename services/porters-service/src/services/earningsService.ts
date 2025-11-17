import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { recordEarning } from '../lib/metrics';
import { EarningType, EarningStatus } from '@prisma/client';

export class EarningsService {
  /**
   * Record earnings for a porter
   */
  async recordEarnings(
    porterId: string,
    type: EarningType,
    amountCents: bigint,
    orderId?: string,
    description?: string,
    metadata?: Record<string, unknown>
  ) {
    const earning = await prisma.porterEarnings.create({
      data: {
        porterId,
        type,
        amountCents,
        orderId,
        status: EarningStatus.PENDING,
        description,
        metadata: metadata as any,
      },
    });

    // Update porter's total earnings
    await prisma.porterProfile.update({
      where: { id: porterId },
      data: {
        totalEarningsCents: {
          increment: amountCents,
        },
      },
    });

    recordEarning(type);

    logger.info('Earnings recorded', {
      porterId,
      type,
      amountCents: amountCents.toString(),
      orderId,
    });

    return earning;
  }

  /**
   * Get earnings summary for a porter
   */
  async getEarningsSummary(porterId: string) {
    const [total, pending, confirmed] = await Promise.all([
      prisma.porterEarnings.aggregate({
        where: { porterId },
        _sum: { amountCents: true },
      }),
      prisma.porterEarnings.aggregate({
        where: { porterId, status: EarningStatus.PENDING },
        _sum: { amountCents: true },
      }),
      prisma.porterEarnings.aggregate({
        where: { porterId, status: EarningStatus.CONFIRMED },
        _sum: { amountCents: true },
      }),
    ]);

    return {
      totalEarningsCents: total._sum.amountCents || BigInt(0),
      pendingEarningsCents: pending._sum.amountCents || BigInt(0),
      confirmedEarningsCents: confirmed._sum.amountCents || BigInt(0),
    };
  }

  /**
   * Get recent earnings transactions
   */
  async getRecentEarnings(porterId: string, limit = 20) {
    return await prisma.porterEarnings.findMany({
      where: { porterId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get earnings by order
   */
  async getOrderEarnings(orderId: string) {
    return await prisma.porterEarnings.findMany({
      where: { orderId },
    });
  }

  /**
   * Update earnings status (e.g., after confirmation or payout)
   */
  async updateEarningStatus(
    earningId: string,
    status: EarningStatus,
    payoutId?: string,
    payoutStatus?: string
  ) {
    return await prisma.porterEarnings.update({
      where: { id: earningId },
      data: {
        status,
        ...(payoutId && { payoutId }),
        ...(payoutStatus && { payoutStatus }),
        ...(status === EarningStatus.PAID_OUT && { payoutAt: new Date() }),
      },
    });
  }

  /**
   * Request withdrawal (integration with Wallets service would go here)
   */
  async requestWithdrawal(
    porterId: string,
    amountCents: bigint,
    idempotencyKey?: string
  ) {
    // Check available balance
    const summary = await this.getEarningsSummary(porterId);

    if (summary.confirmedEarningsCents < amountCents) {
      throw new Error('Insufficient confirmed earnings for withdrawal');
    }

    // TODO: Call Wallets service to process withdrawal
    // For now, we'll just create a withdrawal record

    const withdrawal = await prisma.porterEarnings.create({
      data: {
        porterId,
        type: EarningType.ADJUSTMENT,
        amountCents: -amountCents, // Negative amount for withdrawal
        status: EarningStatus.PENDING,
        description: 'Withdrawal request',
        metadata: {
          withdrawalRequest: true,
          idempotencyKey,
        } as any,
      },
    });

    logger.info('Withdrawal requested', {
      porterId,
      amountCents: amountCents.toString(),
      withdrawalId: withdrawal.id,
    });

    return withdrawal;
  }
}

export default new EarningsService();
