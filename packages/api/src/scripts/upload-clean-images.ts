import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { optimizeToWebp, withWebpExtension, IMMUTABLE_CACHE_CONTROL } from '../utils/image-optimizer.js';

const prisma = new PrismaClient();
const root = path.resolve('prisma/seeds/output/matched_clean');
const dryRun = process.argv.includes('--dry-run');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridas');
}

const supabase = createClient(supabaseUrl, serviceKey);
const bucket = 'products';
const imagePattern = /^(.+)_([0-9]{4})\.(png|jpe?g|webp)$/i;

interface LocalImage {
  sku: string;
  filePath: string;
  filename: string;
}

async function findReadyImages(directory: string): Promise<LocalImage[]> {
  const images: LocalImage[] = [];
  for (const lot of await readdir(directory, { withFileTypes: true })) {
    if (!lot.isDirectory()) continue;
    const readyDirectory = path.join(directory, lot.name, 'listas');
    let files;
    try {
      files = await readdir(readyDirectory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.isFile()) continue;
      const match = imagePattern.exec(file.name);
      if (!match) continue;
      images.push({
        sku: match[1],
        filePath: path.join(readyDirectory, file.name),
        filename: file.name,
      });
    }
  }
  return images.sort((a, b) =>
    a.sku.localeCompare(b.sku) || a.filename.localeCompare(b.filename));
}

try {
  const images = await findReadyImages(root);
  const grouped = new Map<string, LocalImage[]>();
  for (const image of images) {
    const current = grouped.get(image.sku) ?? [];
    current.push(image);
    grouped.set(image.sku, current);
  }
  const products = await prisma.product.findMany({
    where: { sku: { in: [...grouped.keys()] } },
    select: { id: true, sku: true, imagenes: true },
  });
  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  const missingSkus = [...grouped.keys()].filter((sku) => !productsBySku.has(sku));

  if (missingSkus.length > 0) {
    throw new Error(`SKU no encontrados en Supabase: ${missingSkus.join(', ')}`);
  }

  const overLimit = products.filter((product) => {
    const existing = Array.isArray(product.imagenes)
      ? product.imagenes.filter((value): value is string =>
        typeof value === 'string' && !value.includes(`/${product.id}/imported/`))
      : [];
    return existing.length + (grouped.get(product.sku)?.length ?? 0) > 5;
  });
  if (overLimit.length > 0) {
    throw new Error(
      `Productos que superarían cinco imágenes: ${overLimit.map((p) => p.sku).join(', ')}`,
    );
  }

  console.log(JSON.stringify({
    dryRun,
    files: images.length,
    products: products.length,
    productsWithMultipleImages: [...grouped.values()].filter((items) => items.length > 1).length,
  }, null, 2));

  if (dryRun) process.exit(0);

  let uploaded = 0;
  let skipped = 0;
  for (const product of products) {
    const localImages = grouped.get(product.sku) ?? [];
    const existingUrls = Array.isArray(product.imagenes)
      ? product.imagenes.filter((value): value is string => typeof value === 'string')
      : [];
    const expectedUrls = localImages.map((image) => {
      const storagePath = `${product.id}/imported/${withWebpExtension(image.filename)}`;
      return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
    });
    if (expectedUrls.every((url) => existingUrls.includes(url))) {
      skipped += localImages.length;
      continue;
    }
    const importedUrls: string[] = [];

    for (const image of localImages) {
      const storagePath = `${product.id}/imported/${withWebpExtension(image.filename)}`;
      const contents = await readFile(image.filePath);
      const optimized = await optimizeToWebp(contents);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, optimized, {
          contentType: 'image/webp',
          cacheControl: IMMUTABLE_CACHE_CONTROL,
          upsert: true,
        });
      if (error) {
        throw new Error(`Error subiendo ${image.filename}: ${error.message}`);
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      importedUrls.push(data.publicUrl);
      uploaded += 1;
      console.log(`[${uploaded}/${images.length}] ${product.sku} ← ${image.filename} → ${withWebpExtension(image.filename)}`);
    }

    const importedPrefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/${product.id}/imported/`;
    const preservedUrls = existingUrls.filter((url) => !url.startsWith(importedPrefix));
    await prisma.product.update({
      where: { id: product.id },
      data: { imagenes: [...preservedUrls, ...importedUrls] },
    });
  }

  const summary = {
    uploaded,
    skipped,
    total: uploaded + skipped,
    productsUpdated: products.length,
    completedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(root, 'upload-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
