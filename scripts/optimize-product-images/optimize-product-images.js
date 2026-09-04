// One-off maintenance script: optimize oversized images in the Supabase Storage
// "products" bucket (dorella-dev) to reduce cached egress. See README.md.
//
// Usage:
//   pnpm install
//   pnpm optimize            # dry-run (default) — no uploads, no deletes
//   DRY_RUN=false pnpm optimize   # actually uploads optimized copies

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// ── Config (all overridable via env) ───────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.BUCKET || "products";

const MAX_DIMENSION = Number(process.env.MAX_DIMENSION || 1200);
const WEBP_QUALITY = Number(process.env.WEBP_QUALITY || 80);
const SIZE_THRESHOLD_KB = Number(process.env.SIZE_THRESHOLD_KB || 300);

const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const OUTPUT_PREFIX = process.env.OUTPUT_PREFIX || "products-optimized";

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 10);
const BATCH_DELAY_MS = Number(process.env.BATCH_DELAY_MS || 500);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".tiff", ".gif"]);

const REPORT_DIR = path.join(process.cwd(), "reports");
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, "-");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in environment. See .env.example."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(
        `  ! ${label} failed (attempt ${attempt}/${MAX_RETRIES}): ${err.message || err}`
      );
      if (attempt < MAX_RETRIES) await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

// Recursively lists every file in the bucket, descending into subfolders
// (e.g. "imported/"). Supabase Storage's list() only returns one level at a
// time, and folder entries come back with id === null and no metadata.
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
        results.push({
          path: fullPath,
          size: entry.metadata?.size ?? 0,
          contentType: entry.metadata?.mimetype ?? null,
        });
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return results;
}

function extOf(filePath) {
  return path.extname(filePath).toLowerCase();
}

function toKb(bytes) {
  return Math.round((bytes / 1024) * 100) / 100;
}

function toMb(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

// Determines whether an image actually needs an alpha channel (i.e. has any
// non-fully-opaque pixel). If every pixel is opaque, alpha can be dropped for
// extra compression.
async function needsAlphaChannel(image) {
  const meta = await image.metadata();
  if (!meta.hasAlpha) return false;
  const stats = await image.stats();
  const alphaChannel = stats.channels[stats.channels.length - 1];
  // If min === 255 the alpha channel never differs from fully opaque.
  return alphaChannel.min < 255;
}

// ── Core processing ─────────────────────────────────────────────────────────

async function downloadFile(filePath) {
  return withRetries(async () => {
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
    if (error) throw new Error(error.message);
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }, `download ${filePath}`);
}

async function uploadFile(destPath, buffer) {
  return withRetries(async () => {
    const { error } = await supabase.storage.from(BUCKET).upload(destPath, buffer, {
      contentType: "image/webp",
      // destPath is derived 1:1 from the source path and never re-uploaded
      // (upsert: false), so it's safe to cache forever.
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw new Error(error.message);
  }, `upload ${destPath}`);
}

async function optimizeImage(originalBuffer) {
  let image = sharp(originalBuffer, { failOn: "none" });
  const hasAlpha = await needsAlphaChannel(image);

  image = sharp(originalBuffer, { failOn: "none" }).rotate().resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (!hasAlpha) {
    image = image.flatten({ background: "#ffffff" });
  }

  return image.webp({ quality: WEBP_QUALITY, alphaQuality: WEBP_QUALITY }).toBuffer();
}

async function processFile(file) {
  const ext = extOf(file.path);
  const row = {
    path_original: file.path,
    tamano_original_kb: toKb(file.size),
    path_nuevo: "",
    tamano_nuevo_kb: "",
    porcentaje_reduccion: "",
    status: "skipped",
    detalle: "",
  };

  if (!IMAGE_EXTENSIONS.has(ext)) {
    row.detalle = "no es imagen soportada";
    return row;
  }

  try {
    const originalBuffer = await downloadFile(file.path);
    const optimizedBuffer = await optimizeImage(originalBuffer);

    if (optimizedBuffer.length >= originalBuffer.length) {
      row.status = "skipped";
      row.detalle = "original ya era mas eficiente; se conserva";
      row.tamano_nuevo_kb = toKb(optimizedBuffer.length);
      row.porcentaje_reduccion = 0;
      return row;
    }

    const destPath = `${OUTPUT_PREFIX}/${file.path.replace(/\.[^.]+$/, "")}.webp`;
    const reduction = Math.round((1 - optimizedBuffer.length / originalBuffer.length) * 10000) / 100;

    row.path_nuevo = destPath;
    row.tamano_nuevo_kb = toKb(optimizedBuffer.length);
    row.porcentaje_reduccion = reduction;

    if (DRY_RUN) {
      row.status = "ok (dry-run)";
      row.detalle = "no se subio; ejecutar con DRY_RUN=false para subir";
    } else {
      await uploadFile(destPath, optimizedBuffer);
      row.status = "ok";
      row.detalle = "subido a ruta paralela; original intacto";
    }

    return row;
  } catch (err) {
    row.status = "error";
    row.detalle = err.message || String(err);
    return row;
  }
}

async function processInBatches(files, batchSize, delayMs) {
  const results = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(
      `Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)} (${batch.length} imagenes)...`
    );
    const batchResults = await Promise.all(batch.map(processFile));
    results.push(...batchResults);
    if (i + batchSize < files.length) await sleep(delayMs);
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  console.log(`Bucket: ${BUCKET}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`MAX_DIMENSION=${MAX_DIMENSION} WEBP_QUALITY=${WEBP_QUALITY} SIZE_THRESHOLD_KB=${SIZE_THRESHOLD_KB}`);
  console.log("");
  console.log("Listando archivos del bucket (recursivo)...");

  const files = await listAllFiles();

  const inventoryRows = files.map((f) => ({
    path: f.path,
    size_bytes: f.size,
    size_kb: toKb(f.size),
    ext: extOf(f.path) || "(sin extension)",
  }));

  const inventoryJsonPath = path.join(REPORT_DIR, `inventory-${RUN_STAMP}.json`);
  const inventoryCsvPath = path.join(REPORT_DIR, `inventory-${RUN_STAMP}.csv`);
  fs.writeFileSync(inventoryJsonPath, JSON.stringify(inventoryRows, null, 2), "utf8");
  writeCsv(inventoryCsvPath, ["path", "size_bytes", "size_kb", "ext"], inventoryRows);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const candidates = files.filter(
    (f) => IMAGE_EXTENSIONS.has(extOf(f.path)) && f.size > SIZE_THRESHOLD_KB * 1024
  );

  console.log("");
  console.log("── Resumen de inventario ──────────────────────────────");
  console.log(`Total de archivos: ${files.length}`);
  console.log(`Peso total actual: ${toMb(totalBytes)} MB`);
  console.log(`Candidatos a optimizar (> ${SIZE_THRESHOLD_KB} KB): ${candidates.length}`);
  console.log(`Reporte de inventario: ${inventoryCsvPath}`);
  console.log("");

  if (candidates.length === 0) {
    console.log("No hay candidatos para optimizar. Nada que hacer.");
    return;
  }

  console.log(`Procesando ${candidates.length} imagenes en lotes de ${BATCH_SIZE}...`);
  const results = await processInBatches(candidates, BATCH_SIZE, BATCH_DELAY_MS);

  const reportCsvPath = path.join(REPORT_DIR, `optimize-report-${RUN_STAMP}.csv`);
  writeCsv(
    reportCsvPath,
    [
      "path_original",
      "tamano_original_kb",
      "path_nuevo",
      "tamano_nuevo_kb",
      "porcentaje_reduccion",
      "status",
      "detalle",
    ],
    results
  );

  const originalTotalKb = results.reduce((sum, r) => sum + (Number(r.tamano_original_kb) || 0), 0);
  const newTotalKb = results.reduce((sum, r) => {
    const n = Number(r.tamano_nuevo_kb);
    return sum + (Number.isFinite(n) ? n : Number(r.tamano_original_kb) || 0);
  }, 0);
  const savedKb = originalTotalKb - newTotalKb;
  const savedPct = originalTotalKb > 0 ? Math.round((savedKb / originalTotalKb) * 10000) / 100 : 0;

  const okCount = results.filter((r) => r.status.startsWith("ok")).length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  console.log("");
  console.log("── Reporte final ──────────────────────────────────────");
  console.log(`Procesadas: ${results.length} | ok: ${okCount} | skipped: ${skippedCount} | error: ${errorCount}`);
  console.log(`Ahorro estimado: ${toMb(savedKb * 1024)} MB (${savedPct}%)`);
  console.log(`Reporte CSV: ${reportCsvPath}`);

  if (DRY_RUN) {
    console.log("");
    console.log(
      "Modo DRY_RUN: no se subio ni se borro nada. Revisa el reporte y vuelve a correr con DRY_RUN=false para subir las versiones optimizadas a la ruta paralela."
    );
  } else {
    console.log("");
    console.log(
      `Las versiones optimizadas se subieron bajo "${OUTPUT_PREFIX}/". Los originales NO fueron modificados ni borrados.`
    );
  }

  if (errorCount > 0) {
    console.log("");
    console.log(`${errorCount} imagen(es) fallaron. Revisa la columna "detalle" en el CSV.`);
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
