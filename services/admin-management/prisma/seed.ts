import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create super admin user
  const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'changeme', 10);

  const superAdmin = await prisma.adminUser.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL || 'admin@movenow.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@movenow.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('Created super admin:', superAdmin.email);

  // Seed default vehicle types
  const vehicleTypes = [
    {
      name: 'sedan',
      description: 'Standard sedan vehicle',
      maxLoadKg: 200,
      pricingMultiplier: 1.0,
      status: 'ACTIVE' as const,
    },
    {
      name: 'suv',
      description: 'Sport Utility Vehicle',
      maxLoadKg: 400,
      pricingMultiplier: 1.3,
      status: 'ACTIVE' as const,
    },
    {
      name: 'van',
      description: 'Cargo van',
      maxLoadKg: 800,
      pricingMultiplier: 1.5,
      status: 'ACTIVE' as const,
    },
    {
      name: 'truck',
      description: 'Pickup truck',
      maxLoadKg: 1000,
      pricingMultiplier: 1.8,
      status: 'ACTIVE' as const,
    },
  ];

  for (const vt of vehicleTypes) {
    await prisma.vehicleType.upsert({
      where: { name: vt.name },
      update: {},
      create: vt,
    });
  }

  console.log('Created vehicle types');

  // Seed default platform settings
  const settings = [
    {
      key: 'max_porters_per_order',
      value: '10',
      description: 'Maximum number of porters allowed per order',
      updatedBy: superAdmin.id,
    },
    {
      key: 'default_surge_multiplier',
      value: '1.5',
      description: 'Default surge pricing multiplier during high demand',
      updatedBy: superAdmin.id,
    },
    {
      key: 'loyalty_points_per_dollar',
      value: '10',
      description: 'Loyalty points earned per dollar spent',
      updatedBy: superAdmin.id,
    },
    {
      key: 'base_price_per_km',
      value: '200',
      description: 'Base price per kilometer in cents',
      updatedBy: superAdmin.id,
    },
    {
      key: 'porter_commission_percentage',
      value: '80',
      description: 'Percentage of fare that goes to porter',
      updatedBy: superAdmin.id,
    },
  ];

  for (const setting of settings) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('Created platform settings');

  // Create a sample promo code
  const promoCode = await prisma.promoCode.upsert({
    where: { code: 'WELCOME50' },
    update: {},
    create: {
      code: 'WELCOME50',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      usageLimit: 1000,
      eligibleRoles: ['CLIENT'],
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'ACTIVE',
      createdBy: superAdmin.id,
    },
  });

  console.log('Created sample promo code:', promoCode.code);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
