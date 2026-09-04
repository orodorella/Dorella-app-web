// Read-only audit: cross-references every file in the Supabase Storage
// "products" bucket against `products.imagenes` in Postgres to answer
// "what still points at a PNG original vs. an optimized WebP copy, and is
// anything in Storage no longer referenced at all".
//
// This is a reproducible version of the one-off manifest classification
// used on 2026-08-25 (scripts/optimize-product-images/reports/audit-
// manifest-2026-08-25.csv) — that file had no committed script behind it.
//
// This script NEVER writes to Storage or the database. It only reads and
// produces a report CSV + a console summary. There is no flag that makes it
// mutate anything — re-run it as often as needed.
//
// Usage (from repo root, so DATABASE_URL and the Prisma client resolve):
//   node scripts/optimize-product-images/audit-image-references.js
//
// Env (same convention as optimize-product-images.js):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)
//   BUCKET (default "products")
//   OUTPUT_PREFIX (default "products-optimized") — the parallel path used
//     for already-optimized copies, excluded from the "original" classification.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// DATABASE_URL lives in the repo root .env (Prisma schema is in packages/api).
// Mirrors migrate-image-urls.js: intentionally does NOT read this folder's
// own .env (that one holds Supabase creds for the optimizer script).
dotenvConfigRootEnv();
function dotenvConfigRootEnv() {
  const rootEnvPath = path.join(SCRIPT_DIR, "..", "..", ".env");
  if (fs.existsSync(rootEnvPath)) {
    for (const line of fs.readFileSync(rootEnvPath, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.BUCKET || "products";
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX || "products-optimized";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in environment."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const REPORT_DIR = path.join(SCRIPT_DIR, "reports");
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, "-");

function toKb(bytes) {
  return Math.round((bytes / 1024) * 100) / 100;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

// Recursively lists every file in the bucket (same approach as
// optimize-product-images.js — Storage's list() is not recursive).
async function listAllFiles(prefix = "") {
  const results = [];
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`list(${prefix}) failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = entry.id === null && !entry.metadata;
      if (isFolder) {
        const nested = await listAllFiles(fullPath);
        results.push(...nested);
      } else {
        results.push({ path: fullPath, size: entry.metadata?.size ?? 0 });
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return results;
}

// Extracts the Storage-relative path from a public Supabase URL, the same
// way migrate-image-urls.js does, so classification lines up with what the
// DB actually stores.
function storagePathFromPublicUrl(url) {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  console.log(`Bucket: ${BUCKET}`);
  console.log(`OUTPUT_PREFIX (optimized copies): ${OUTPUT_PREFIX}`);
  console.log("Modo: solo lectura. No se escribe en Storage ni en la base de datos.");
  console.log("");
  console.log("Listando archivos del bucket (recursivo)...");
  const files = await listAllFiles();

  console.log("Leyendo products.imagenes desde Postgres...");
  const prisma = new PrismaClient();
  let products;
  try {
    products = await prisma.product.findMany({
      select: { id: true, sku: true, isActive: true, imagenes: true },
    });
  } finally {
    await prisma.$disconnect();
  }

  // Map: storage path -> [{ sku, isActive }] referencing it (an image can in
  // principle be reused/duplicated across products, so this is not assumed
  // to be 1:1).
  const referencesByPath = new Map();
  const productsWithNoImages = [];

  for (const product of products) {
    const urls = Array.isArray(product.imagenes)
      ? product.imagenes.filter((v) => typeof v === "string")
      : [];
    if (product.isActive && urls.length === 0) {
      productsWithNoImages.push({ id: product.id, sku: product.sku });
    }
    for (const url of urls) {
      const storagePath = storagePathFromPublicUrl(url);
      if (!storagePath) continue;
      const refs = referencesByPath.get(storagePath) ?? [];
      refs.push({ sku: product.sku, isActive: product.isActive });
      referencesByPath.set(storagePath, refs);
    }
  }

  const rows = [];
  for (const file of files) {
    const isOptimizedCopy = file.path.startsWith(`${OUTPUT_PREFIX}/`);
    // A file can already be WebP without living under OUTPUT_PREFIX/ — e.g.
    // uploaded straight through storage.service.ts's uploadProductImage,
    // which writes WebP to its canonical (non-"imported/") path. That is
    // NOT a pending-optimization original; treat it separately so it isn't
    // counted as something the backfill still needs to touch.
    const isWebp = /\.webp$/i.test(file.path);
    const refs = referencesByPath.get(file.path) ?? [];
    const referenced = refs.length > 0;

    let classification;
    if (isOptimizedCopy) {
      classification = referenced ? "referenced-optimized" : "optimized-copy-unreferenced";
    } else if (isWebp) {
      classification = referenced ? "referenced-canonical-webp" : "orphan-canonical-webp";
    } else {
      classification = referenced ? "referenced-original" : "orphan-candidate-original";
    }

    rows.push({
      path: file.path,
      size_kb: toKb(file.size),
      classification,
      referenced_by_sku: refs.map((r) => r.sku).join(";"),
    });
  }

  const manifestPath = path.join(REPORT_DIR, `audit-manifest-${RUN_STAMP}.csv`);
  writeCsv(manifestPath, ["path", "size_kb", "classification", "referenced_by_sku"], rows);

  const byClass = {};
  for (const row of rows) byClass[row.classification] = (byClass[row.classification] ?? 0) + 1;

  // Distinct-product counts matter: an image ROW count is not the same as a
  // PRODUCT count (a product can have more than one un-migrated original).
  const referencedOriginalSkus = new Set();
  for (const row of rows) {
    if (row.classification === "referenced-original") {
      row.referenced_by_sku.split(";").filter(Boolean).forEach((sku) => referencedOriginalSkus.add(sku));
    }
  }

  console.log("");
  console.log("── Resumen ─────────────────────────────────────────────");
  console.log(`Total de archivos en el bucket: ${files.length}`);
  for (const [cls, count] of Object.entries(byClass)) {
    console.log(`  ${cls}: ${count}`);
  }
  console.log("");
  console.log(
    `referenced-original: ${byClass["referenced-original"] ?? 0} imagenes, en ${referencedOriginalSkus.size} productos distintos.`
  );
  console.log(
    `Productos activos sin ninguna imagen: ${productsWithNoImages.length}`
  );
  if (productsWithNoImages.length > 0) {
    console.log(`  ${productsWithNoImages.map((p) => p.sku).join(", ")}`);
  }
  console.log("");
  console.log(`Reporte: ${manifestPath}`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
