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

  const clientPassword = await bcrypt.hash('demo123dorela', 12);
  const clients = [
    { email: 'detal@dorela.co', nombre: 'Cliente', apellido: 'Detal', tier: 'detal' as const },
    { email: 'mayorista@dorela.co', nombre: 'Cliente', apellido: 'Mayorista', tier: 'por_mayor' as const },
    { email: 'granmayor@dorela.co', nombre: 'Cliente', apellido: 'Gran Mayor', tier: 'gran_mayor' as const },
  ];

  for (const c of clients) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        passwordHash: clientPassword,
        nombre: c.nombre,
        apellido: c.apellido,
        role: 'cliente',
        tier: c.tier,
      },
    });
    console.log(`  Cliente: ${user.email} (${user.role}/${user.tier})`);
  }

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
