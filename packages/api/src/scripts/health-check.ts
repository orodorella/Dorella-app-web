import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const userCount = await prisma.user.count();
    const categoryCount = await prisma.category.count();
    console.log('DB connected OK');
    console.log(`  Users: ${userCount}`);
    console.log(`  Categories: ${categoryCount}`);
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
