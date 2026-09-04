import sharp from 'sharp';

// Shared by every code path that puts a product/course photo into Supabase
// Storage (manual admin upload in storage.service.ts, bulk import in
// upload-clean-images.ts) so a raw multi-MB PNG never reaches Storage
// un-optimized regardless of which path it came in through.
export const MAX_DIMENSION = 1600;
export const WEBP_QUALITY = 82;
// Filenames produced by both callers are unique and never overwritten, so
// caching the WebP output forever is safe.
export const IMMUTABLE_CACHE_CONTROL = '31536000';

export async function optimizeToWebp(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer, { failOn: 'none' }).rotate();
  const meta = await image.metadata();

  let pipeline = sharp(buffer, { failOn: 'none' }).rotate().resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (meta.hasAlpha) {
    const stats = await image.stats();
    const alphaChannel = stats.channels[stats.channels.length - 1];
    const isFullyOpaque = alphaChannel.min === 255;
    if (isFullyOpaque) pipeline = pipeline.flatten({ background: '#ffffff' });
  }

  const optimized = await pipeline.webp({ quality: WEBP_QUALITY, alphaQuality: WEBP_QUALITY }).toBuffer();
  // Extremely rare (e.g. a tiny already-compressed icon): don't ship a
  // larger file than what was uploaded.
  return optimized.length < buffer.length ? optimized : buffer;
}

export function withWebpExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') + '.webp';
}
