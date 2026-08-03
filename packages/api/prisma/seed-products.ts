import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRODUCTS_SQL_PATH = path.join(__dirname, 'seeds', '03_products_insert.sql');

const REQUIRED_CATEGORIES = [
  { nombre: 'Topos y Candongas', slug: 'topos-y-candongas', orden: 1 },
  { nombre: 'Herrajes', slug: 'herrajes', orden: 2 },
  { nombre: 'Balinería', slug: 'balineria', orden: 3 },
  { nombre: 'Dijes', slug: 'dijes', orden: 4 },
  { nombre: 'Cadenería', slug: 'cadeneria', orden: 5 },
  { nombre: 'Pulseras', slug: 'pulseras', orden: 6 },
  { nombre: 'Tobilleras', slug: 'tobilleras', orden: 7 },
  { nombre: 'Insumos', slug: 'insumos', orden: 8 },
] as const;

interface SourceProductSummary {
  sku: string;
  categorySlug: string;
}

function extractSourceProducts(sql: string): SourceProductSummary[] {
  const products: SourceProductSummary[] = [];
  const lines = sql.split(/\r?\n/);
  const tuplePattern = /^\s*\(gen_random_uuid\(\),\s*'((?:''|[^'])*)',.*?WHERE slug = '((?:''|[^'])*)'/;

  for (const line of lines) {
    const match = line.match(tuplePattern);
    if (!match) continue;

    products.push({
      sku: match[1].replace(/''/g, "'"),
      categorySlug: match[2].replace(/''/g, "'"),
    });
  }

  return products;
}

function ensureOnConflict(sql: string): string {
  const trimmed = sql.trim();
  if (/ON CONFLICT\s*\(sku\)\s*DO NOTHING\s*;?\s*$/i.test(trimmed)) {
    return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
  }

  if (trimmed.endsWith(';')) {
    return `${trimmed.slice(0, -1)}\nON CONFLICT (sku) DO NOTHING;`;
  }

  return `${trimmed}\nON CONFLICT (sku) DO NOTHING;`;
}

async function ensureCategories() {
  for (const category of REQUIRED_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        nombre: category.nombre,
        orden: category.orden,
        isActive: true,
      },
      create: {
        nombre: category.nombre,
        slug: category.slug,
        orden: category.orden,
        isActive: true,
      },
    });
  }
}

async function main() {
  const shouldApply = process.argv.includes('--apply');
  const sqlContents = await fs.readFile(PRODUCTS_SQL_PATH, 'utf8');
  const normalizedSql = ensureOnConflict(sqlContents);
  const sourceProducts = extractSourceProducts(normalizedSql);

  if (sourceProducts.length === 0) {
    throw new Error('No se encontraron productos en 03_products_insert.sql');
  }

  const uniqueSourceSkus = new Set(sourceProducts.map((product) => product.sku));
  if (uniqueSourceSkus.size !== sourceProducts.length) {
    throw new Error(
      `El archivo fuente tiene SKUs duplicados (${sourceProducts.length - uniqueSourceSkus.size} repetidos). Revisa 03_products_insert.sql antes de continuar.`,
    );
  }

  const sourceCategorySlugs = new Set(sourceProducts.map((product) => product.categorySlug));
  const unknownCategorySlugs = [...sourceCategorySlugs].filter(
    (slug) => !REQUIRED_CATEGORIES.some((category) => category.slug === slug),
  );

  if (unknownCategorySlugs.length > 0) {
    throw new Error(
      `El archivo fuente referencia categorías no contempladas por el script: ${unknownCategorySlugs.join(', ')}`,
    );
  }

  const existingProducts = await prisma.product.findMany({
    select: { sku: true },
  });

  const existingSkus = new Set(existingProducts.map((product) => product.sku));
  const alreadyExistingCount = sourceProducts.filter((product) => existingSkus.has(product.sku)).length;
  const missingProducts = sourceProducts.filter((product) => !existingSkus.has(product.sku));

  console.log('[seed-products] Modo:', shouldApply ? 'apply' : 'dry-run');
  console.log('[seed-products] Archivo fuente:', PRODUCTS_SQL_PATH);
  console.log('[seed-products] Total productos fuente:', sourceProducts.length);
  console.log('[seed-products] Total productos existentes en DB:', existingProducts.length);
  console.log('[seed-products] SKUs ya existentes:', alreadyExistingCount);
  console.log('[seed-products] SKUs faltantes:', missingProducts.length);
  console.log('[seed-products] Productos que se insertarían:', missingProducts.length);

  if (!shouldApply) {
    console.log('[seed-products] Dry-run completado. No se ejecutó ningún insert.');
    console.log('[seed-products] Para aplicar el catálogo, corre: pnpm --filter api prisma:seed:products -- --apply');
    return;
  }

  await ensureCategories();

  const beforeCount = await prisma.product.count();
  const inserted = await prisma.$executeRawUnsafe(normalizedSql);
  const afterCount = await prisma.product.count();
  const insertedCount = Math.max(0, afterCount - beforeCount);

  console.log('[seed-products] Categorías aseguradas por slug:', REQUIRED_CATEGORIES.length);
  console.log('[seed-products] Filas reportadas por PostgreSQL:', inserted);
  console.log('[seed-products] Productos insertados:', insertedCount);
  console.log('[seed-products] Productos omitidos por duplicado:', alreadyExistingCount);
  console.log('[seed-products] Total productos en DB después del proceso:', afterCount);
}

main()
  .catch((error) => {
    console.error('[seed-products] Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
