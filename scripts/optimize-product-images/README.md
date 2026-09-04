# optimize-product-images

Script de mantenimiento (uso puntual) para reducir el peso de las imágenes del
bucket `products` en Supabase Storage (proyecto `dorella-dev`), que están
consumiendo demasiado cached egress al servirse como PNG de 2-7MB.

Redimensiona (máx. 1200px en el lado más largo), convierte a WebP calidad 80,
y **nunca sobrescribe ni borra el original**. Los archivos optimizados se
suben a una ruta paralela `products-optimized/<mismo-path>.webp` solo cuando
corres el script en modo real (`DRY_RUN=false`).

## Setup

```bash
cd scripts/optimize-product-images
pnpm install   # o: npm install
cp .env.example .env
```

Edita `.env` con las credenciales del proyecto `dorella-dev`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (service role key — nunca la anon key, y nunca
  la subas a git)

## Paso 1 — Dry-run (por defecto, no sube ni borra nada)

```bash
pnpm optimize
```

Esto:

1. Lista recursivamente todos los archivos del bucket (incluyendo subcarpetas
   como `imported/`) y genera `reports/inventory-<timestamp>.csv` /ave `.json`.
2. Identifica candidatos (> `SIZE_THRESHOLD_KB`, default 300 KB).
3. Descarga, redimensiona y convierte cada candidato a WebP **en memoria**,
   sin subir nada.
4. Genera `reports/optimize-report-<timestamp>.csv` con el antes/después
   estimado (tamaño original, tamaño nuevo, % de reducción, status).
5. Imprime en consola el resumen y el ahorro total estimado.

Revisa el CSV de reporte antes de continuar.

## Paso 2 — Modo real (sube las versiones optimizadas)

Solo después de revisar el dry-run:

```bash
DRY_RUN=false pnpm optimize
```

- Sube cada versión optimizada a `products-optimized/<mismo-path>.webp`
  (ruta paralela, configurable con `OUTPUT_PREFIX`).
- **No borra ni sobrescribe los originales.** Eso se hace manualmente
  después de verificar en producción que las nuevas imágenes se ven bien.

## Parámetros (env vars, ver `.env.example`)

| Variable | Default | Descripción |
|---|---|---|
| `MAX_DIMENSION` | 1200 | Lado más largo tras el resize (px) |
| `WEBP_QUALITY` | 80 | Calidad WebP (0-100) |
| `SIZE_THRESHOLD_KB` | 300 | Solo se optimizan archivos por encima de este tamaño |
| `DRY_RUN` | true | `false` para subir de verdad |
| `OUTPUT_PREFIX` | products-optimized | Prefijo de la ruta paralela de subida |
| `BATCH_SIZE` | 10 | Imágenes procesadas concurrentemente por lote |
| `BATCH_DELAY_MS` | 500 | Pausa entre lotes |
| `MAX_RETRIES` | 3 | Reintentos por descarga/subida ante fallos transitorios |

## Paso 3 — Repuntar la base de datos a las imágenes optimizadas (opcional)

Subir las imágenes optimizadas a `products-optimized/` **no cambia nada en
producción** por sí solo: la columna `products.imagenes` en Postgres sigue
apuntando a las rutas originales hasta que se actualice explícitamente.

`migrate-image-urls.js` lee un `optimize-report-*.csv` (columna `path_original`
→ `path_nuevo`, solo filas `status = ok`) y reescribe las URLs en
`products.imagenes` para los productos cuya imagen actual coincide con una
optimizada. No borra ni sube nada a Storage — solo actualiza filas en la base
de datos.

Este script usa `@prisma/client`, ya generado para `packages/api` en la raíz
del monorepo, así que **debe correrse desde la raíz del repo** (para que
resuelva `node_modules/@prisma/client` y lea `DATABASE_URL` del `.env` raíz):

```bash
cd ../..   # raíz del repo, si vienes de scripts/optimize-product-images

# Dry-run (default): solo genera un preview CSV, no toca la base de datos
node scripts/optimize-product-images/migrate-image-urls.js \
  --report scripts/optimize-product-images/reports/optimize-report-<timestamp>.csv

# Aplicar de verdad (una sola transacción)
DRY_RUN=false node scripts/optimize-product-images/migrate-image-urls.js \
  --report scripts/optimize-product-images/reports/optimize-report-<timestamp>.csv
```

El preview queda en `reports/migrate-preview-<timestamp>.csv` con columnas
`id, sku, imagenes_antes, imagenes_despues`. Revísalo antes de correr con
`DRY_RUN=false`.

Nota: los productos cuyas imágenes no superaban el umbral de 300 KB (no eran
candidatas a optimizar) quedan sin tocar — es esperado, no un error.

## Auditoría de referencias (solo lectura, repetible)

`audit-image-references.js` cruza **todo** el bucket `products` contra
`products.imagenes` en Postgres y clasifica cada archivo:

- `referenced-original` — PNG/JPEG **sin optimizar** todavía referenciado por
  al menos un producto (pendiente de migrar).
- `orphan-candidate-original` — original sin optimizar ya no referenciado por
  ningún producto (candidato a limpieza futura, no se borra automáticamente).
- `referenced-optimized` — copia WebP bajo `products-optimized/` que sí está
  siendo usada.
- `optimized-copy-unreferenced` — copia WebP subida pero cuyo producto aún no
  fue repuntado (o ya no existe).
- `referenced-canonical-webp` / `orphan-canonical-webp` — archivo `.webp` que
  ya vive en su ruta canónica (no bajo `products-optimized/`), típicamente
  porque se subió directo por `storage.service.ts` (ya optimizado desde el
  origen). **No** cuenta como pendiente de backfill aunque no esté bajo
  `products-optimized/`.

**Nunca escribe en Storage ni en la base de datos** — solo lee y genera
`reports/audit-manifest-<timestamp>.csv` con columnas
`path, size_kb, classification, referenced_by_sku` (una imagen puede estar
referenciada por más de un producto; `referenced_by_sku` lista todos).

El resumen en consola distingue explícitamente **filas de imagen** de
**productos distintos** — el número de imágenes `referenced-original` no es
necesariamente igual al número de productos afectados (un producto puede
tener más de una imagen sin migrar). También reporta productos activos sin
ninguna imagen.

```bash
# Desde la raíz del repo (igual que migrate-image-urls.js, por Prisma):
node scripts/optimize-product-images/audit-image-references.js
```

Úsalo antes y después de cada corrida de `migrate-image-urls.js` para
confirmar que `referenced-original` baja a 0.

## Notas

- Si el PNG original no tiene transparencia real (canal alfa 100% opaco), el
  script lo aplana a fondo blanco antes de convertir a WebP para ganar
  compresión extra.
- Si por alguna razón la versión optimizada resulta más pesada que el
  original (raro, pasa con imágenes ya muy comprimidas), el script conserva
  el original y lo marca como `skipped` en el reporte — no sube nada para
  ese archivo.
- Los errores por archivo no detienen el script; quedan registrados en la
  columna `detalle` del CSV con status `error`.
