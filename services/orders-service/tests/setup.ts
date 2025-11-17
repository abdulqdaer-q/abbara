import { prisma } from '../src/lib/prisma';

// Setup before all tests
beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
});

// Teardown after all tests
afterAll(async () => {
  // Disconnect from test database
  await prisma.$disconnect();
});

// Clean up after each test
afterEach(async () => {
  // Clear all tables (in correct order due to foreign keys)
  await prisma.orderEvent.deleteMany();
  await prisma.orderEvidence.deleteMany();
  await prisma.orderAssignment.deleteMany();
  await prisma.orderPricingSnapshot.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderStop.deleteMany();
  await prisma.order.deleteMany();
  await prisma.idempotencyKey.deleteMany();
});
