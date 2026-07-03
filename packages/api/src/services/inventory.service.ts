import type { Tier } from 'shared/src/types/user.js';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/db.js';
import { formatProductForTier } from './pricing.service.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

interface ProductFilters {
  categoria?: string;
  search?: string;
  soloDisponibles?: boolean;
}

const categorySelect = { id: true, nombre: true, slug: true } as const;

export async function getProducts(
  tier: Tier | null,
  filters: ProductFilters,
  query: Record<string, unknown>,
) {
  const { page, pageSize } = parsePagination(query);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma where clause built dynamically
  const where: Record<string, unknown> = { isActive: true };

  if (filters.categoria) {
    where.category = { slug: filters.categoria };
  }

  if (filters.search) {
    where.OR = [
      { nombre: { contains: filters.search, mode: 'insensitive' as const } },
      { sku: { contains: filters.search, mode: 'insensitive' as const } },
    ];
  }

  if (filters.soloDisponibles) {
    where.stock = { gt: 0 };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: categorySelect } },
      orderBy: [{ isFeatured: 'desc' }, { nombre: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  const data = products.map((p: typeof products[number]) => formatProductForTier(p, tier));
  const meta = buildMeta(page, pageSize, total);

  return { data, meta };
}

export async function getProductById(id: string, tier: Tier | null) {
  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: { category: { select: categorySelect } },
  });

  if (!product) return null;

  return formatProductForTier(product, tier);
}

export async function getFeaturedProducts(tier: Tier | null) {
  const products = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    include: { category: { select: categorySelect } },
    orderBy: { nombre: 'asc' },
    take: 12,
  });

  return products.map((p: typeof products[number]) => formatProductForTier(p, tier));
}

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { orden: 'asc' },
    select: { id: true, nombre: true, slug: true, descripcion: true, imagenUrl: true, orden: true },
  });
}

export async function checkStock(productId: string, cantidad: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, stockReservado: true, nombre: true },
  });

  if (!product) return { available: false as const, reason: 'Producto no encontrado' };

  const disponible = product.stock - product.stockReservado;
  if (disponible < cantidad) {
    return { available: false as const, reason: `Stock insuficiente para ${product.nombre}. Disponible: ${disponible}` };
  }

  return { available: true as const, disponible };
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export async function reserveStock(productId: string, cantidad: number, tx: TxClient) {
  await tx.$queryRawUnsafe(
    `SELECT id FROM products WHERE id = $1 FOR UPDATE`,
    productId,
  );

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stock: true, stockReservado: true },
  });

  if (!product) throw new Error(`Producto ${productId} no encontrado`);

  const disponible = product.stock - product.stockReservado;
  if (disponible < cantidad) {
    throw new Error(`Stock insuficiente. Disponible: ${disponible}, solicitado: ${cantidad}`);
  }

  await tx.product.update({
    where: { id: productId },
    data: { stockReservado: { increment: cantidad } },
  });
}

export async function releaseStock(productId: string, cantidad: number, tx: TxClient) {
  await tx.product.update({
    where: { id: productId },
    data: { stockReservado: { decrement: cantidad } },
  });
}

// --- Admin functions ---

export async function getAdminProducts(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true, sku: true, nombre: true, descripcion: true, precioBase: true,
        imagenes: true, material: true, pesoGramos: true, stock: true, stockReservado: true,
        isFeatured: true, isActive: true, tags: true, alegraItemId: true,
        category: { select: { id: true, nombre: true, slug: true } },
      },
      orderBy: [{ isActive: 'desc' }, { nombre: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count(),
  ]);

  const data = products.map((p: typeof products[number]) => ({
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precioBase: Number(p.precioBase),
    precio: Number(p.precioBase),
    imagenes: p.imagenes as string[],
    material: p.material,
    pesoGramos: p.pesoGramos ? Number(p.pesoGramos) : null,
    stock: p.stock,
    stockReservado: p.stockReservado,
    isFeatured: p.isFeatured,
    isActive: p.isActive,
    tags: p.tags,
    alegraItemId: p.alegraItemId,
    categoria: p.category,
  }));

  const meta = buildMeta(page, pageSize, total);
  return { data, meta };
}

interface CreateProductInput {
  sku: string;
  nombre: string;
  descripcion?: string;
  precioBase: number;
  categoryId: string;
  imagenes?: string[];
  material?: string;
  pesoGramos?: number;
  stock?: number;
  isFeatured?: boolean;
  tags?: string[];
}

export async function createProduct(input: CreateProductInput) {
  return prisma.product.create({
    data: {
      sku: input.sku,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      precioBase: input.precioBase,
      categoryId: input.categoryId,
      imagenes: input.imagenes ?? [],
      material: input.material ?? null,
      pesoGramos: input.pesoGramos ?? null,
      stock: input.stock ?? 0,
      isFeatured: input.isFeatured ?? false,
      tags: input.tags ?? [],
    },
    include: { category: { select: { id: true, nombre: true, slug: true } } },
  });
}

interface UpdateProductInput {
  sku?: string;
  nombre?: string;
  descripcion?: string | null;
  precioBase?: number;
  categoryId?: string;
  imagenes?: string[];
  material?: string | null;
  pesoGramos?: number | null;
  stock?: number;
  isFeatured?: boolean;
  tags?: string[];
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return null;

  return prisma.product.update({
    where: { id },
    data: input,
    include: { category: { select: { id: true, nombre: true, slug: true } } },
  });
}

export async function adjustStock(id: string, stock: number) {
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return null;

  return prisma.product.update({
    where: { id },
    data: { stock },
  });
}

export async function softDeleteProduct(id: string, deactivatedBy: string) {
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return null;

  return prisma.product.update({
    where: { id },
    data: { isActive: false, deactivatedAt: new Date(), deactivatedBy },
  });
}
