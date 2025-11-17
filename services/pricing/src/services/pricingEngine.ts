import { PricingRule, RuleType, CustomerType as DbCustomerType, VehicleType as DbVehicleType } from '@prisma/client';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { config } from '../config';
import {
  PricingEstimateInput,
  PricingEstimateOutput,
  PriceBreakdownItem,
  AppliedRule,
  CustomerType,
  VehicleType,
} from '@movenow/common';

/**
 * Rule configuration types for different rule types
 */
interface BaseFareConfig {
  amountCents: number;
}

interface PerKmConfig {
  ratePerKm: number;
  tiers?: Array<{ upToKm: number; rate: number }>;
}

interface PerMinuteConfig {
  ratePerMinute: number;
}

interface PorterFeeConfig {
  perPorter: number;
  tiers?: Array<{ porters: number; rate: number }>;
}

interface ItemSurchargeConfig {
  weightThresholdKg?: number;
  sizeThresholdCm3?: number;
  surchargePerItem?: number;
  surchargeFlat?: number;
}

interface MinimumFareConfig {
  minimumCents: number;
}

interface MultiplierConfig {
  multiplier: number;
}

interface DiscountConfig {
  type: 'percentage' | 'fixed';
  value: number; // percentage (1-100) or cents
}

interface ServiceFeeConfig {
  type: 'percentage' | 'fixed';
  value: number;
}

interface TaxConfig {
  rate: number; // e.g., 0.08 for 8%
  applyAfterDiscount: boolean;
}

interface MultiStopFeeConfig {
  perStop: number;
}

/**
 * Pricing calculation context
 */
interface PricingContext {
  input: PricingEstimateInput;
  distanceMeters: number;
  durationSeconds: number;
  distanceKm: number;
  durationMinutes: number;
  additionalStopsCount: number;
  totalItemVolumeCm3: number;
  totalItemWeightKg: number;
  correlationId: string;
}

/**
 * Intermediate calculation result
 */
interface CalculationResult {
  baseFareCents: number;
  distanceFareCents: number;
  timeFareCents: number;
  porterFeesCents: number;
  surchargesCents: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  serviceFeesCents: number;
  totalCents: number;
  breakdown: PriceBreakdownItem[];
  rulesApplied: AppliedRule[];
}

/**
 * Main pricing engine class
 */
export class PricingEngine {
  /**
   * Calculate price estimate
   */
  async calculateEstimate(
    input: PricingEstimateInput,
    distanceMeters: number,
    durationSeconds: number,
    correlationId: string
  ): Promise<PricingEstimateOutput> {
    // Build pricing context
    const context: PricingContext = {
      input,
      distanceMeters,
      durationSeconds,
      distanceKm: distanceMeters / 1000,
      durationMinutes: durationSeconds / 60,
      additionalStopsCount: input.additionalStops?.length || 0,
      totalItemVolumeCm3: this.calculateTotalVolume(input.items || []),
      totalItemWeightKg: this.calculateTotalWeight(input.items || []),
      correlationId,
    };

    // Get applicable rules
    const rules = await this.getApplicableRules(context);

    logger.debug('Applicable rules found', {
      correlationId,
      count: rules.length,
      ruleIds: rules.map(r => r.id),
    });

    // Initialize calculation result
    const result: CalculationResult = {
      baseFareCents: 0,
      distanceFareCents: 0,
      timeFareCents: 0,
      porterFeesCents: 0,
      surchargesCents: 0,
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      serviceFeesCents: 0,
      totalCents: 0,
      breakdown: [],
      rulesApplied: [],
    };

    // Apply rules in priority order
    for (const rule of rules) {
      this.applyRule(rule, context, result);
    }

    // Calculate subtotal
    result.subtotalCents =
      result.baseFareCents +
      result.distanceFareCents +
      result.timeFareCents +
      result.porterFeesCents +
      result.surchargesCents;

    // Apply minimum fare if needed
    const minimumFare = this.getMinimumFare(rules);
    if (minimumFare && result.subtotalCents < minimumFare) {
      const adjustment = minimumFare - result.subtotalCents;
      result.breakdown.push({
        type: 'MINIMUM_FARE_ADJUSTMENT',
        amountCents: adjustment,
        description: `Minimum fare adjustment to meet ${this.formatCents(minimumFare)}`,
      });
      result.subtotalCents = minimumFare;
    }

    // Calculate final total
    result.totalCents = result.subtotalCents - result.discountCents + result.taxCents + result.serviceFeesCents;

    // Ensure total is not negative
    if (result.totalCents < 0) {
      logger.warn('Negative total calculated, setting to 0', {
        correlationId,
        calculatedTotal: result.totalCents,
      });
      result.totalCents = 0;
    }

    // Build output
    const output: PricingEstimateOutput = {
      baseFareCents: result.baseFareCents,
      distanceFareCents: result.distanceFareCents,
      timeFareCents: result.timeFareCents,
      porterFeesCents: result.porterFeesCents,
      surchargesCents: result.surchargesCents,
      subtotalCents: result.subtotalCents,
      discountCents: result.discountCents,
      taxCents: result.taxCents,
      serviceFeesCents: result.serviceFeesCents,
      totalCents: result.totalCents,
      currency: config.defaultCurrency,
      breakdown: result.breakdown,
      rulesApplied: result.rulesApplied,
      estimatedDistanceMeters: distanceMeters,
      estimatedDurationSeconds: durationSeconds,
      estimatedArrivalTime: input.scheduledAt || new Date(Date.now() + durationSeconds * 1000),
    };

    logger.info('Pricing calculation completed', {
      correlationId,
      totalCents: result.totalCents,
      rulesApplied: result.rulesApplied.length,
    });

    return output;
  }

  /**
   * Get applicable pricing rules for the context
   */
  private async getApplicableRules(context: PricingContext): Promise<PricingRule[]> {
    const now = new Date();
    const scheduledAt = context.input.scheduledAt || now;

    // Map string enums to database enums
    const vehicleType = this.mapVehicleType(context.input.vehicleType);
    const customerType = this.mapCustomerType(context.input.customerType || 'consumer');

    const rules = await prisma.pricingRule.findMany({
      where: {
        enabled: true,
        status: 'ACTIVE',
        effectiveFrom: { lte: scheduledAt },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: scheduledAt } },
        ],
        vehicleTypes: {
          has: vehicleType,
        },
        customerTypes: {
          has: customerType,
        },
      },
      include: {
        timeWindows: true,
        geoZones: true,
      },
      orderBy: {
        priority: 'desc', // Higher priority first
      },
    });

    // Filter by time windows if applicable
    return rules.filter(rule => {
      if (rule.timeWindows.length === 0) return true;
      return this.isInTimeWindow(scheduledAt, rule.timeWindows);
    });
  }

  /**
   * Apply a single pricing rule
   */
  private applyRule(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const appliedRule: AppliedRule = {
      ruleId: rule.id,
      ruleVersion: rule.version,
      ruleName: rule.name,
      ruleType: rule.ruleType,
    };

    switch (rule.ruleType) {
      case RuleType.BASE_FARE:
        this.applyBaseFare(rule, context, result);
        break;
      case RuleType.PER_KM:
        this.applyPerKm(rule, context, result);
        break;
      case RuleType.PER_MINUTE:
        this.applyPerMinute(rule, context, result);
        break;
      case RuleType.PORTER_FEE:
        this.applyPorterFee(rule, context, result);
        break;
      case RuleType.ITEM_SIZE_SURCHARGE:
        this.applyItemSurcharge(rule, context, result);
        break;
      case RuleType.PEAK_MULTIPLIER:
      case RuleType.GEO_MULTIPLIER:
        this.applyMultiplier(rule, context, result);
        break;
      case RuleType.PROMO_DISCOUNT:
        this.applyDiscount(rule, context, result);
        break;
      case RuleType.SERVICE_FEE:
        this.applyServiceFee(rule, context, result);
        break;
      case RuleType.TAX:
        this.applyTax(rule, context, result);
        break;
      case RuleType.MULTI_STOP_FEE:
        this.applyMultiStopFee(rule, context, result);
        break;
      default:
        logger.warn('Unknown rule type', { ruleType: rule.ruleType, ruleId: rule.id });
    }

    result.rulesApplied.push(appliedRule);
  }

  /**
   * Apply base fare rule
   */
  private applyBaseFare(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const config = rule.config as BaseFareConfig;
    result.baseFareCents += config.amountCents;
    result.breakdown.push({
      type: 'BASE_FARE',
      ruleId: rule.id,
      amountCents: config.amountCents,
      description: rule.name,
    });
  }

  /**
   * Apply per-kilometer rule
   */
  private applyPerKm(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const config = rule.config as PerKmConfig;
    let amountCents = 0;

    if (config.tiers && config.tiers.length > 0) {
      // Tiered pricing
      let remainingKm = context.distanceKm;
      let previousThreshold = 0;

      for (const tier of config.tiers) {
        const tierKm = Math.min(remainingKm, tier.upToKm - previousThreshold);
        if (tierKm > 0) {
          amountCents += Math.round(tierKm * tier.rate);
          remainingKm -= tierKm;
          previousThreshold = tier.upToKm;
        }
      }

      // Handle remaining distance beyond last tier
      if (remainingKm > 0) {
        const lastTier = config.tiers[config.tiers.length - 1];
        amountCents += Math.round(remainingKm * lastTier.rate);
      }
    } else {
      // Flat rate per km
      amountCents = Math.round(context.distanceKm * config.ratePerKm);
    }

    result.distanceFareCents += amountCents;
    result.breakdown.push({
      type: 'DISTANCE_FEE',
      ruleId: rule.id,
      amountCents,
      description: `${rule.name} (${context.distanceKm.toFixed(2)} km)`,
    });
  }

  /**
   * Apply per-minute rule
   */
  private applyPerMinute(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const config = rule.config as PerMinuteConfig;
    const amountCents = Math.round(context.durationMinutes * config.ratePerMinute);

    result.timeFareCents += amountCents;
    result.breakdown.push({
      type: 'TIME_FEE',
      ruleId: rule.id,
      amountCents,
      description: `${rule.name} (${Math.round(context.durationMinutes)} min)`,
    });
  }

  /**
   * Apply porter fee rule
   */
  private applyPorterFee(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    if (context.input.porterCount === 0) return;

    const config = rule.config as PorterFeeConfig;
    let amountCents = 0;

    if (config.tiers && config.tiers.length > 0) {
      // Tiered pricing by number of porters
      const tier = config.tiers.find(t => context.input.porterCount <= t.porters);
      amountCents = tier ? tier.rate : config.perPorter * context.input.porterCount;
    } else {
      // Flat rate per porter
      amountCents = config.perPorter * context.input.porterCount;
    }

    result.porterFeesCents += amountCents;
    result.breakdown.push({
      type: 'PORTER_FEE',
      ruleId: rule.id,
      amountCents,
      description: `${rule.name} (${context.input.porterCount} porters)`,
    });
  }

  /**
   * Apply item size/weight surcharge
   */
  private applyItemSurcharge(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const config = rule.config as ItemSurchargeConfig;
    let amountCents = 0;
    let triggered = false;

    if (config.weightThresholdKg && context.totalItemWeightKg > config.weightThresholdKg) {
      triggered = true;
    }

    if (config.sizeThresholdCm3 && context.totalItemVolumeCm3 > config.sizeThresholdCm3) {
      triggered = true;
    }

    if (triggered) {
      if (config.surchargeFlat) {
        amountCents = config.surchargeFlat;
      } else if (config.surchargePerItem) {
        const itemCount = context.input.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        amountCents = config.surchargePerItem * itemCount;
      }
    }

    if (amountCents > 0) {
      result.surchargesCents += amountCents;
      result.breakdown.push({
        type: 'ITEM_SURCHARGE',
        ruleId: rule.id,
        amountCents,
        description: rule.name,
      });
    }
  }

  /**
   * Apply multiplier (surge/peak/geo)
   */
  private applyMultiplier(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const config = rule.config as MultiplierConfig;
    const cappedMultiplier = Math.min(config.multiplier, config.maxSurgeMultiplier);

    // Apply to current subtotal (base + distance + time + porter + surcharges)
    const currentSubtotal =
      result.baseFareCents +
      result.distanceFareCents +
      result.timeFareCents +
      result.porterFeesCents +
      result.surchargesCents;

    const surchargeAmount = Math.round(currentSubtotal * (cappedMultiplier - 1));

    if (surchargeAmount > 0) {
      result.surchargesCents += surchargeAmount;
      result.breakdown.push({
        type: rule.ruleType === RuleType.PEAK_MULTIPLIER ? 'PEAK_SURCHARGE' : 'GEO_SURCHARGE',
        ruleId: rule.id,
        amountCents: surchargeAmount,
        description: `${rule.name} (${cappedMultiplier}x)`,
      });
    }
  }

  /**
   * Apply discount (promo)
   */
  private applyDiscount(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const config = rule.config as DiscountConfig;
    let amountCents = 0;

    const currentSubtotal =
      result.baseFareCents +
      result.distanceFareCents +
      result.timeFareCents +
      result.porterFeesCents +
      result.surchargesCents;

    if (config.type === 'percentage') {
      amountCents = Math.round(currentSubtotal * (config.value / 100));
    } else {
      amountCents = config.value;
    }

    result.discountCents += amountCents;
    result.breakdown.push({
      type: 'DISCOUNT',
      ruleId: rule.id,
      amountCents,
      description: rule.name,
    });
  }

  /**
   * Apply service fee
   */
  private applyServiceFee(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const config = rule.config as ServiceFeeConfig;
    let amountCents = 0;

    const subtotal = result.subtotalCents || 0;

    if (config.type === 'percentage') {
      amountCents = Math.round(subtotal * (config.value / 100));
    } else {
      amountCents = config.value;
    }

    result.serviceFeesCents += amountCents;
    result.breakdown.push({
      type: 'SERVICE_FEE',
      ruleId: rule.id,
      amountCents,
      description: rule.name,
    });
  }

  /**
   * Apply tax
   */
  private applyTax(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    const config = rule.config as TaxConfig;

    const taxableAmount = config.applyAfterDiscount
      ? result.subtotalCents - result.discountCents
      : result.subtotalCents;

    const amountCents = Math.round(taxableAmount * config.rate);

    result.taxCents += amountCents;
    result.breakdown.push({
      type: 'TAX',
      ruleId: rule.id,
      amountCents,
      description: `${rule.name} (${(config.rate * 100).toFixed(1)}%)`,
    });
  }

  /**
   * Apply multi-stop fee
   */
  private applyMultiStopFee(rule: PricingRule, context: PricingContext, result: CalculationResult): void {
    if (context.additionalStopsCount === 0) return;

    const config = rule.config as MultiStopFeeConfig;
    const amountCents = config.perStop * context.additionalStopsCount;

    result.surchargesCents += amountCents;
    result.breakdown.push({
      type: 'MULTI_STOP_FEE',
      ruleId: rule.id,
      amountCents,
      description: `${rule.name} (${context.additionalStopsCount} stops)`,
    });
  }

  /**
   * Get minimum fare from rules
   */
  private getMinimumFare(rules: PricingRule[]): number | null {
    const minimumFareRule = rules.find(r => r.ruleType === RuleType.MINIMUM_FARE);
    if (!minimumFareRule) return null;

    const config = minimumFareRule.config as MinimumFareConfig;
    return config.minimumCents;
  }

  /**
   * Check if scheduled time is in any time window
   */
  private isInTimeWindow(scheduledAt: Date, timeWindows: any[]): boolean {
    if (timeWindows.length === 0) return true;

    const dayOfWeek = scheduledAt.getDay();
    const minutesFromMidnight = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();

    return timeWindows.some(tw => {
      const inDay = tw.dayOfWeek.includes(dayOfWeek);
      const inTime = minutesFromMidnight >= tw.startTime && minutesFromMidnight <= tw.endTime;
      return inDay && inTime;
    });
  }

  /**
   * Calculate total item volume
   */
  private calculateTotalVolume(items: any[]): number {
    return items.reduce((sum, item) => {
      const volume = (item.lengthCm || 0) * (item.widthCm || 0) * (item.heightCm || 0);
      return sum + volume * item.quantity;
    }, 0);
  }

  /**
   * Calculate total item weight
   */
  private calculateTotalWeight(items: any[]): number {
    return items.reduce((sum, item) => {
      return sum + (item.weightKg || 0) * item.quantity;
    }, 0);
  }

  /**
   * Map vehicle type from common to database enum
   */
  private mapVehicleType(type: VehicleType): DbVehicleType {
    const mapping: Record<VehicleType, DbVehicleType> = {
      sedan: 'SEDAN',
      suv: 'SUV',
      van: 'VAN',
      truck: 'TRUCK',
    };
    return mapping[type];
  }

  /**
   * Map customer type from common to database enum
   */
  private mapCustomerType(type: CustomerType): DbCustomerType {
    const mapping: Record<CustomerType, DbCustomerType> = {
      consumer: 'CONSUMER',
      business: 'BUSINESS',
      enterprise: 'ENTERPRISE',
    };
    return mapping[type];
  }

  /**
   * Format cents to currency string
   */
  private formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

/**
 * Singleton pricing engine instance
 */
export const pricingEngine = new PricingEngine();
