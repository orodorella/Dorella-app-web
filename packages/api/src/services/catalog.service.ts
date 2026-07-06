import { prisma } from '../config/db.js';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let existing = await prisma.catalogo.findUnique({ where: { slug } });
  let counter = 2;
  while (existing) {
    slug = `${slugify(base)}-${counter}`;
    existing = await prisma.catalogo.findUnique({ where: { slug } });
    counter++;
  }
  return slug;
}

interface CreateInput {
  nombre: string;
  configuracion: { negocio: string; logo_url?: string | null; color_principal?: string; mostrar_precios?: boolean };
}

export async function createCatalogo(userId: string, input: CreateInput) {
  const slug = await uniqueSlug(input.nombre);
  return prisma.catalogo.create({
    data: {
      userId,
      nombre: input.nombre,
      slug,
      configuracion: input.configuracion,
    },
    include: { _count: { select: { productos: true } } },
  });
}

export async function updateCatalogo(catalogoId: string, userId: string, input: { nombre?: string; configuracion?: Record<string, unknown> }) {
  const catalogo = await prisma.catalogo.findFirst({ where: { id: catalogoId, userId } });
  if (!catalogo) return null;

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (input.nombre) data.nombre = input.nombre;
  if (input.configuracion) {
    data.configuracion = { ...(catalogo.configuracion as Record<string, unknown>), ...input.configuracion };
  }

  return prisma.catalogo.update({
    where: { id: catalogoId },
    data,
    include: { _count: { select: { productos: true } } },
  });
}

export async function deleteCatalogo(catalogoId: string, userId: string) {
  const catalogo = await prisma.catalogo.findFirst({ where: { id: catalogoId, userId } });
  if (!catalogo) return null;
  return prisma.catalogo.update({
    where: { id: catalogoId },
    data: { activo: false, updatedAt: new Date(), deactivatedAt: new Date(), deactivatedBy: userId },
  });
}

export async function toggleCatalogo(catalogoId: string, userId: string) {
  const catalogo = await prisma.catalogo.findFirst({ where: { id: catalogoId, userId } });
  if (!catalogo) return null;
  return prisma.catalogo.update({
    where: { id: catalogoId },
    data: { activo: !catalogo.activo, updatedAt: new Date() },
  });
}

export async function addProductos(catalogoId: string, userId: string, productos: Array<{ productId: string; precioPersonalizado?: number | null }>) {
  const catalogo = await prisma.catalogo.findFirst({ where: { id: catalogoId, userId } });
  if (!catalogo) return null;

  const maxOrden = await prisma.catalogoProducto.aggregate({
    where: { catalogoId },
    _max: { orden: true },
  });
  let nextOrden = (maxOrden._max.orden ?? -1) + 1;

  const existing = await prisma.catalogoProducto.findMany({
    where: { catalogoId, productId: { in: productos.map((p) => p.productId) } },
    select: { productId: true },
  });
  const existingIds = new Set(existing.map((e) => e.productId));
  const toCreate = productos.filter((p) => !existingIds.has(p.productId));

  let created: Awaited<ReturnType<typeof prisma.catalogoProducto.findMany>> = [];
  if (toCreate.length > 0) {
    const data = toCreate.map((p) => ({
      catalogoId,
      productId: p.productId,
      precioPersonalizado: p.precioPersonalizado ?? null,
      orden: nextOrden++,
    }));
    await prisma.catalogoProducto.createMany({ data, skipDuplicates: true });
    created = await prisma.catalogoProducto.findMany({
      where: { catalogoId, productId: { in: toCreate.map((p) => p.productId) } },
    });
  }

  await prisma.catalogo.update({ where: { id: catalogoId }, data: { updatedAt: new Date() } });
  return created;
}

export async function removeProducto(catalogoId: string, userId: string, productId: string) {
  const catalogo = await prisma.catalogo.findFirst({ where: { id: catalogoId, userId } });
  if (!catalogo) return null;
  return prisma.catalogoProducto.deleteMany({ where: { catalogoId, productId } });
}

export async function reorderProductos(catalogoId: string, userId: string, orden: Array<{ productId: string; orden: number }>) {
  const catalogo = await prisma.catalogo.findFirst({ where: { id: catalogoId, userId } });
  if (!catalogo) return null;

  if (orden.length === 0) return true;

  const values = orden.map((_, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::int)`).join(', ');
  const params = orden.flatMap((item) => [item.productId, item.orden]);
  await prisma.$executeRawUnsafe(
    `UPDATE catalogo_productos AS cp SET orden = v.orden FROM (VALUES ${values}) AS v(product_id, orden) WHERE cp.catalogo_id = $${orden.length * 2 + 1}::uuid AND cp.product_id = v.product_id`,
    ...params, catalogoId,
  );
  return true;
}

export async function getCatalogos(userId: string) {
  return prisma.catalogo.findMany({
    where: { userId },
    include: { _count: { select: { productos: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCatalogoById(catalogoId: string, userId: string) {
  return prisma.catalogo.findFirst({
    where: { id: catalogoId, userId },
    include: {
      productos: {
        include: {
          product: {
            select: { id: true, sku: true, nombre: true, descripcion: true, imagenes: true, material: true },
          },
        },
        orderBy: { orden: 'asc' },
      },
    },
  });
}

export async function getCatalogoPublico(slug: string) {
  const catalogo = await prisma.catalogo.findUnique({
    where: { slug },
    include: {
      productos: {
        include: {
          product: {
            select: { id: true, nombre: true, descripcion: true, imagenes: true, material: true, isActive: true },
          },
        },
        orderBy: { orden: 'asc' },
      },
    },
  });

  if (!catalogo || !catalogo.activo) return null;

  const config = catalogo.configuracion as { negocio?: string; logo_url?: string | null; color_principal?: string; mostrar_precios?: boolean };

  return {
    id: catalogo.id,
    nombre: catalogo.nombre,
    configuracion: config,
    productos: catalogo.productos
      .filter((cp) => cp.product.isActive)
      .map((cp) => ({
        id: cp.product.id,
        nombre: cp.product.nombre,
        descripcion: cp.product.descripcion,
        imagen: (cp.product.imagenes as string[])?.[0] || null,
        material: cp.product.material,
        precio: config.mostrar_precios ? cp.precioPersonalizado : null,
      })),
  };
}
