import { PrismaClient, VehicleType, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create sample porter profiles
  const porter1 = await prisma.porterProfile.upsert({
    where: { userId: 'user-porter-1' },
    update: {},
    create: {
      userId: 'user-porter-1',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      email: 'john.doe@example.com',
      vehicleType: VehicleType.SEDAN,
      vehicleModel: 'Toyota Camry',
      vehiclePlate: 'ABC-123',
      vehicleColor: 'Blue',
      vehicleCapacity: 4,
      verificationStatus: VerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      isActive: true,
      isSuspended: false,
      rating: 4.8,
      completedJobsCount: 150,
    },
  });

  const porter2 = await prisma.porterProfile.upsert({
    where: { userId: 'user-porter-2' },
    update: {},
    create: {
      userId: 'user-porter-2',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+1234567891',
      email: 'jane.smith@example.com',
      vehicleType: VehicleType.VAN,
      vehicleModel: 'Ford Transit',
      vehiclePlate: 'XYZ-789',
      vehicleColor: 'White',
      vehicleCapacity: 6,
      verificationStatus: VerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      isActive: true,
      isSuspended: false,
      rating: 4.9,
      completedJobsCount: 220,
    },
  });

  const porter3 = await prisma.porterProfile.upsert({
    where: { userId: 'user-porter-3' },
    update: {},
    create: {
      userId: 'user-porter-3',
      firstName: 'Mike',
      lastName: 'Johnson',
      phone: '+1234567892',
      email: 'mike.johnson@example.com',
      vehicleType: VehicleType.TRUCK,
      vehicleModel: 'Chevrolet Silverado',
      vehiclePlate: 'TRK-456',
      vehicleColor: 'Black',
      vehicleCapacity: 3,
      verificationStatus: VerificationStatus.PENDING,
      isActive: true,
      isSuspended: false,
      rating: 0,
      completedJobsCount: 0,
    },
  });

  console.log('Created porter profiles:', {
    porter1: porter1.id,
    porter2: porter2.id,
    porter3: porter3.id,
  });

  // Create verification history for porter1
  await prisma.verificationHistory.create({
    data: {
      porterId: porter1.id,
      status: VerificationStatus.VERIFIED,
      changedBy: 'admin-1',
      notes: 'All documents verified successfully',
    },
  });

  // Create some sample earnings
  await prisma.porterEarnings.createMany({
    data: [
      {
        porterId: porter1.id,
        type: 'JOB_PAYMENT',
        amountCents: BigInt(1500),
        orderId: 'order-1',
        status: 'CONFIRMED',
        description: 'Delivery completed',
      },
      {
        porterId: porter1.id,
        type: 'TIP',
        amountCents: BigInt(500),
        orderId: 'order-1',
        status: 'CONFIRMED',
        description: 'Customer tip',
      },
      {
        porterId: porter2.id,
        type: 'JOB_PAYMENT',
        amountCents: BigInt(2000),
        orderId: 'order-2',
        status: 'CONFIRMED',
        description: 'Large item delivery',
      },
    ],
  });

  console.log('Seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
