import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('admin123dorela', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dorela.co' },
    update: {},
    create: {
      email: 'admin@dorela.co',
      passwordHash: adminPassword,
      nombre: 'Admin',
      apellido: 'Dorela',
      role: 'admin',
      tier: 'detal',
    },
  });
  console.log(`  Admin: ${admin.email} (${admin.id})`);

  const categorias = [
    { nombre: 'Aretes', slug: 'aretes', orden: 1 },
    { nombre: 'Cadenas', slug: 'cadenas', orden: 2 },
    { nombre: 'Anillos', slug: 'anillos', orden: 3 },
    { nombre: 'Pulseras', slug: 'pulseras', orden: 4 },
    { nombre: 'Dijes', slug: 'dijes', orden: 5 },
    { nombre: 'Conjuntos', slug: 'conjuntos', orden: 6 },
    { nombre: 'Tobilleras', slug: 'tobilleras', orden: 7 },
    { nombre: 'Broches', slug: 'broches', orden: 8 },
  ];

  for (const cat of categorias) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`  Categorías: ${categorias.length} creadas`);

  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
