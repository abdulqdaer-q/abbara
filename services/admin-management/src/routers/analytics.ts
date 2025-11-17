import { router, protectedProcedure } from '../trpc';
import { ViewAnalyticsInputSchema, AnalyticsDataSchema } from '../types/schemas';
import { requirePermission, Permission } from '../middleware/rbac';
import { prisma } from '../lib/prisma';
import { config } from '../lib/config';

export const analyticsRouter = router({
  /**
   * Get analytics data
   */
  get: protectedProcedure
    .input(ViewAnalyticsInputSchema)
    .output(AnalyticsDataSchema)
    .query(async ({ input, ctx }) => {
      requirePermission(ctx.admin.role, Permission.VIEW_ANALYTICS);

      if (!config.features.analytics) {
        throw new Error('Analytics feature is disabled');
      }

      const { metricsType, dateFrom, dateTo, groupBy } = input;

      // Generate date labels based on groupBy
      const labels = generateDateLabels(dateFrom, dateTo, groupBy);

      let datasets: any[] = [];
      let summary: Record<string, any> = {};

      switch (metricsType) {
        case 'ORDERS':
          datasets = await getOrdersAnalytics(dateFrom, dateTo, groupBy);
          summary = await getOrdersSummary(dateFrom, dateTo);
          break;

        case 'REVENUE':
          datasets = await getRevenueAnalytics(dateFrom, dateTo, groupBy);
          summary = await getRevenueSummary(dateFrom, dateTo);
          break;

        case 'RATINGS':
          datasets = await getRatingsAnalytics(dateFrom, dateTo, groupBy);
          summary = await getRatingsSummary(dateFrom, dateTo);
          break;

        case 'PORTER_ACTIVITY':
          datasets = await getPorterActivityAnalytics(dateFrom, dateTo, groupBy);
          summary = await getPorterActivitySummary(dateFrom, dateTo);
          break;

        case 'USER_GROWTH':
          datasets = await getUserGrowthAnalytics(dateFrom, dateTo, groupBy);
          summary = await getUserGrowthSummary(dateFrom, dateTo);
          break;

        case 'PROMO_USAGE':
          datasets = await getPromoUsageAnalytics(dateFrom, dateTo, groupBy);
          summary = await getPromoUsageSummary(dateFrom, dateTo);
          break;

        default:
          throw new Error(`Unsupported metrics type: ${metricsType}`);
      }

      return {
        labels,
        datasets,
        summary,
      };
    }),

  /**
   * Get dashboard summary
   */
  getDashboardSummary: protectedProcedure.query(async ({ ctx }) => {
    requirePermission(ctx.admin.role, Permission.VIEW_ANALYTICS);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalOrders,
      pendingVerifications,
      activePromoCodes,
      totalRevenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.porterDocument.count({ where: { status: 'PENDING' } }),
      prisma.promoCode.count({ where: { status: 'ACTIVE' } }),
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { priceCents: true },
      }),
    ]);

    return {
      totalUsers,
      totalOrders,
      pendingVerifications,
      activePromoCodes,
      revenueLastMonth: totalRevenue._sum.priceCents || 0,
    };
  }),
});

// Helper functions for analytics

function generateDateLabels(dateFrom: Date, dateTo: Date, groupBy: string): string[] {
  const labels: string[] = [];
  const current = new Date(dateFrom);

  while (current <= dateTo) {
    if (groupBy === 'DAY') {
      labels.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    } else if (groupBy === 'WEEK') {
      labels.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 7);
    } else if (groupBy === 'MONTH') {
      labels.push(current.toISOString().substring(0, 7));
      current.setMonth(current.getMonth() + 1);
    }
  }

  return labels;
}

async function getOrdersAnalytics(dateFrom: Date, dateTo: Date, _groupBy: string) {
  // Simplified - in production, use proper SQL aggregation
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    select: { createdAt: true, status: true },
  });

  return [
    {
      label: 'Total Orders',
      data: [orders.length],
    },
  ];
}

async function getOrdersSummary(dateFrom: Date, dateTo: Date) {
  const total = await prisma.order.count({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
  });
  const completed = await prisma.order.count({
    where: { createdAt: { gte: dateFrom, lte: dateTo }, status: 'COMPLETED' },
  });
  const cancelled = await prisma.order.count({
    where: { createdAt: { gte: dateFrom, lte: dateTo }, status: 'CANCELLED' },
  });

  return { total, completed, cancelled, completionRate: total > 0 ? (completed / total) * 100 : 0 };
}

async function getRevenueAnalytics(dateFrom: Date, dateTo: Date, _groupBy: string) {
  const revenue = await prisma.order.aggregate({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      status: 'COMPLETED',
    },
    _sum: { priceCents: true },
  });

  return [
    {
      label: 'Revenue',
      data: [revenue._sum.priceCents || 0],
    },
  ];
}

async function getRevenueSummary(dateFrom: Date, dateTo: Date) {
  const result = await prisma.order.aggregate({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      status: 'COMPLETED',
    },
    _sum: { priceCents: true },
    _avg: { priceCents: true },
    _count: true,
  });

  return {
    totalRevenue: result._sum.priceCents || 0,
    averageOrderValue: result._avg.priceCents || 0,
    completedOrders: result._count,
  };
}

async function getRatingsAnalytics(_dateFrom: Date, _dateTo: Date, _groupBy: string) {
  // Placeholder - would integrate with ratings service
  return [{ label: 'Average Rating', data: [4.5] }];
}

async function getRatingsSummary(_dateFrom: Date, _dateTo: Date) {
  return { averageRating: 4.5, totalRatings: 0 };
}

async function getPorterActivityAnalytics(_dateFrom: Date, _dateTo: Date, _groupBy: string) {
  const activePorters = await prisma.user.count({
    where: { role: 'PORTER', status: 'ACTIVE' },
  });

  return [{ label: 'Active Porters', data: [activePorters] }];
}

async function getPorterActivitySummary(_dateFrom: Date, _dateTo: Date) {
  const totalPorters = await prisma.user.count({ where: { role: 'PORTER' } });
  const activePorters = await prisma.user.count({
    where: { role: 'PORTER', status: 'ACTIVE' },
  });
  const verifiedPorters = await prisma.user.count({
    where: { role: 'PORTER', verificationStatus: 'APPROVED' },
  });

  return { totalPorters, activePorters, verifiedPorters };
}

async function getUserGrowthAnalytics(dateFrom: Date, dateTo: Date, _groupBy: string) {
  const users = await prisma.user.count({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
  });

  return [{ label: 'New Users', data: [users] }];
}

async function getUserGrowthSummary(dateFrom: Date, dateTo: Date) {
  const newUsers = await prisma.user.count({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
  });
  const totalUsers = await prisma.user.count();

  return { newUsers, totalUsers };
}

async function getPromoUsageAnalytics(_dateFrom: Date, _dateTo: Date, _groupBy: string) {
  const promoCodes = await prisma.promoCode.findMany({
    select: { code: true, usageCount: true },
  });

  return promoCodes.map(promo => ({
    label: promo.code,
    data: [promo.usageCount],
  }));
}

async function getPromoUsageSummary(_dateFrom: Date, _dateTo: Date) {
  const totalPromoCodes = await prisma.promoCode.count();
  const activePromoCodes = await prisma.promoCode.count({ where: { status: 'ACTIVE' } });
  const totalUsage = await prisma.promoCode.aggregate({
    _sum: { usageCount: true },
  });

  return {
    totalPromoCodes,
    activePromoCodes,
    totalUsage: totalUsage._sum.usageCount || 0,
  };
}
