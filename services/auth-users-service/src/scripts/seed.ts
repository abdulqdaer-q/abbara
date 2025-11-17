import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/password';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seed...');

  // Create admin user
  const adminPassword = await hashPassword('Admin123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@movenow.com' },
    update: {},
    create: {
      email: 'admin@movenow.com',
      passwordHash: adminPassword,
      displayName: 'Admin User',
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  logger.info('Admin user created', { userId: admin.id });

  // Create customer users
  const customerPassword = await hashPassword('Customer123!');
  const customer1 = await prisma.user.upsert({
    where: { email: 'customer1@example.com' },
    update: {},
    create: {
      email: 'customer1@example.com',
      passwordHash: customerPassword,
      displayName: 'John Doe',
      role: 'CUSTOMER',
      emailVerified: true,
    },
  });
  logger.info('Customer 1 created', { userId: customer1.id });

  const customer2 = await prisma.user.upsert({
    where: { email: 'customer2@example.com' },
    update: {},
    create: {
      email: 'customer2@example.com',
      phone: '+1234567890',
      passwordHash: customerPassword,
      displayName: 'Jane Smith',
      role: 'CUSTOMER',
      emailVerified: true,
      phoneVerified: true,
    },
  });
  logger.info('Customer 2 created', { userId: customer2.id });

  // Create porter users with profiles
  const porterPassword = await hashPassword('Porter123!');
  const porter1 = await prisma.user.upsert({
    where: { email: 'porter1@example.com' },
    update: {},
    create: {
      email: 'porter1@example.com',
      passwordHash: porterPassword,
      displayName: 'Mike Porter',
      role: 'PORTER',
      emailVerified: true,
      porterProfile: {
        create: {
          verificationStatus: 'VERIFIED',
          rating: 4.5,
          totalRatings: 120,
          verifiedAt: new Date(),
          documentsMetadata: [
            {
              type: 'drivers_license',
              url: 'https://example.com/docs/dl1.pdf',
              uploadedAt: new Date().toISOString(),
            },
            {
              type: 'vehicle_registration',
              url: 'https://example.com/docs/vr1.pdf',
              uploadedAt: new Date().toISOString(),
            },
          ],
        },
      },
    },
  });
  logger.info('Porter 1 created', { userId: porter1.id });

  const porter2 = await prisma.user.upsert({
    where: { email: 'porter2@example.com' },
    update: {},
    create: {
      email: 'porter2@example.com',
      phone: '+1234567891',
      passwordHash: porterPassword,
      displayName: 'Sarah Transport',
      role: 'PORTER',
      emailVerified: true,
      phoneVerified: true,
      porterProfile: {
        create: {
          verificationStatus: 'PENDING',
          rating: 0,
          totalRatings: 0,
          verificationRequestedAt: new Date(),
          documentsMetadata: [
            {
              type: 'drivers_license',
              url: 'https://example.com/docs/dl2.pdf',
              uploadedAt: new Date().toISOString(),
            },
          ],
        },
      },
    },
  });
  logger.info('Porter 2 created', { userId: porter2.id });

  logger.info('Database seed completed successfully!');
  logger.info('\nTest Credentials:');
  logger.info('Admin: admin@movenow.com / Admin123!');
  logger.info('Customer 1: customer1@example.com / Customer123!');
  logger.info('Customer 2: customer2@example.com / Customer123!');
  logger.info('Porter 1 (Verified): porter1@example.com / Porter123!');
  logger.info('Porter 2 (Pending): porter2@example.com / Porter123!');
}

main()
  .catch((error) => {
    logger.error('Seed failed', { error });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
