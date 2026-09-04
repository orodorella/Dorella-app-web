// Repoints products.imagenes URLs from the original (heavy) Storage paths to
// the optimized WebP copies uploaded by optimize-product-images.js.
//
// Reads the optimize-report-*.csv (path_original -> path_nuevo mapping, only
// rows with status "ok"), matches it against each product's `imagenes` JSONB
// array, and updates rows whose current URL matches an optimized original.
//
// Safety:
//   - DRY_RUN=true (default): prints a diff (product id/sku, old URL, new
//     URL) and writes reports/migrate-preview-<timestamp>.csv. No DB writes.
//   - DRY_RUN=false: applies the UPDATEs inside a single transaction.
//   - Only touches products whose imagenes contain a URL under
//     .../public/products/<path> that has a matching optimized entry with
//     status "ok" in the report. Products with no match are left untouched.
//   - Does not delete or modify Storage objects — DB only.
//
// Usage:
//   node migrate-image-urls.js --report reports/optimize-report-<ts>.csv
//   DRY_RUN=false node migrate-image-urls.js --report reports/optimize-report-<ts>.csv

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

// DATABASE_URL lives in the repo root .env (Prisma schema is in packages/api).
// This script intentionally does NOT read scripts/optimize-product-images/.env
// (that file's DRY_RUN/SUPABASE_* values are for the image-optimizer script,
// not this one — mixing them risks accidentally flipping DRY_RUN here).
dotenv.config({ path: path.join(SCRIPT_DIR, "..", "..", ".env") });

const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const REPORT_DIR = path.join(SCRIPT_DIR, "reports");
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, "-");

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--report");
  if (idx === -1 || !args[idx + 1]) {
    console.error("Usage: node migrate-image-urls.js --report <path-to-optimize-report.csv>");
    process.exit(1);
  }
  return { reportPath: args[idx + 1] };
}

// Minimal CSV parser sufficient for the report format produced by
// optimize-product-images.js (no embedded newlines in quoted fields here,
// but we still handle quoted commas defensively).
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
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

async function main() {
  const { reportPath } = parseArgs();
  if (!fs.existsSync(reportPath)) {
    console.error(`Report not found: ${reportPath}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(reportPath, "utf8")).filter((r) => r.status === "ok");
  if (rows.length === 0) {
    console.log('No rows with status "ok" in the report. Nothing to migrate.');
    return;
  }

  // path_original / path_nuevo are Storage paths relative to the bucket
  // root, e.g. "abc/imported/X.png" -> "products-optimized/abc/imported/X.webp".
  const pathMap = new Map(rows.map((r) => [r.path_original, r.path_nuevo]));

  console.log(`Mapeo cargado desde ${reportPath}: ${pathMap.size} rutas optimizadas.`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log("");

  const prisma = new PrismaClient();
  const products = await prisma.$queryRawUnsafe(
    "SELECT id, sku, imagenes FROM products WHERE jsonb_array_length(imagenes) > 0"
  );

  const changes = [];

  for (const product of products) {
    const urls = product.imagenes;
    let changed = false;
    const newUrls = urls.map((url) => {
      const marker = "/object/public/products/";
      const idx = url.indexOf(marker);
      if (idx === -1) return url;
      const storagePath = decodeURIComponent(url.slice(idx + marker.length));
      const optimizedPath = pathMap.get(storagePath);
      if (!optimizedPath) return url;
      changed = true;
      const base = url.slice(0, idx + marker.length);
      return base + optimizedPath;
    });

    if (changed) {
      changes.push({
        id: product.id,
        sku: product.sku,
        imagenes_antes: JSON.stringify(urls),
        imagenes_despues: JSON.stringify(newUrls),
        newUrls,
      });
    }
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const previewPath = path.join(REPORT_DIR, `migrate-preview-${RUN_STAMP}.csv`);
  writeCsv(
    previewPath,
    ["id", "sku", "imagenes_antes", "imagenes_despues"],
    changes.map(({ id, sku, imagenes_antes, imagenes_despues }) => ({ id, sku, imagenes_antes, imagenes_despues }))
  );

  console.log(`Productos a actualizar: ${changes.length} de ${products.length} con imagenes.`);
  console.log(`Preview: ${previewPath}`);
  console.log("");
  console.log("Ejemplos:");
  for (const c of changes.slice(0, 5)) {
    console.log(`  [${c.sku}] ${c.id}`);
    console.log(`    antes:   ${c.imagenes_antes}`);
    console.log(`    despues: ${c.imagenes_despues}`);
  }

  if (DRY_RUN) {
    console.log("");
    console.log("Modo DRY_RUN: no se aplico ningun UPDATE. Revisa el preview CSV.");
    console.log("Para aplicar: DRY_RUN=false node migrate-image-urls.js --report " + reportPath);
    await prisma.$disconnect();
    return;
  }

  console.log("");
  console.log(`Aplicando ${changes.length} UPDATEs en una transaccion...`);

  await prisma.$transaction(
    changes.map((c) =>
      prisma.$executeRawUnsafe(
        `UPDATE products SET imagenes = $1::jsonb, updated_at = now() WHERE id = $2::uuid`,
        JSON.stringify(c.newUrls),
        c.id
      )
    )
  );

  console.log(`Listo. ${changes.length} productos actualizados.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
