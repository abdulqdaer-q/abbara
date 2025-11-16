import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding bidding service database...');

  // Create default bid strategies
  const strategies = [
    {
      id: 'weighted-score-v1',
      name: 'Weighted Score v1',
      description: 'Balanced strategy weighing price, ETA, rating, reliability, and distance',
      version: 1,
      parameters: {
        priceWeight: 0.4,
        etaWeight: 0.3,
        ratingWeight: 0.15,
        reliabilityWeight: 0.1,
        distanceWeight: 0.05,
      },
      isActive: true,
    },
    {
      id: 'price-focused-v1',
      name: 'Price Focused v1',
      description: 'Strategy heavily favoring lowest price bids',
      version: 1,
      parameters: {
        priceWeight: 0.7,
        etaWeight: 0.15,
        ratingWeight: 0.1,
        reliabilityWeight: 0.05,
        distanceWeight: 0.0,
      },
      isActive: true,
    },
    {
      id: 'speed-focused-v1',
      name: 'Speed Focused v1',
      description: 'Strategy prioritizing fastest arrival times',
      version: 1,
      parameters: {
        priceWeight: 0.2,
        etaWeight: 0.5,
        ratingWeight: 0.15,
        reliabilityWeight: 0.1,
        distanceWeight: 0.05,
      },
      isActive: true,
    },
    {
      id: 'quality-focused-v1',
      name: 'Quality Focused v1',
      description: 'Strategy prioritizing highly-rated and reliable porters',
      version: 1,
      parameters: {
        priceWeight: 0.2,
        etaWeight: 0.2,
        ratingWeight: 0.35,
        reliabilityWeight: 0.25,
        distanceWeight: 0.0,
      },
      isActive: true,
    },
  ];

  for (const strategy of strategies) {
    await prisma.bidStrategy.upsert({
      where: { id: strategy.id },
      update: {},
      create: strategy,
    });

    console.log(`✓ Created strategy: ${strategy.name}`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
