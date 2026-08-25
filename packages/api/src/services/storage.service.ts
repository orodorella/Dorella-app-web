import sharp from 'sharp';
import { getSupabaseAdmin } from '../config/supabase.js';

const BUCKET = 'products';

// Uploaded product/course photos come straight from a camera or admin's
// computer (multi-MB PNGs are common) and are re-served on every catalog,
// home, and detail render. Re-encoding to a capped WebP here — instead of
// storing the original — is what keeps Supabase Storage egress bounded,
// since there is no other resizing step before Supabase.
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;
// New uploads always get a unique, content-addressed-ish filename and are
// never overwritten (upsert: false), so it's safe to cache them forever.
const IMMUTABLE_CACHE_CONTROL = '31536000';

async function optimizeToWebp(buffer: Buffer): Promise<Buffer> {
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

function withWebpExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') + '.webp';
}

export async function uploadProductImage(
  productId: string,
  file: { buffer: Buffer; filename: string; mimetype: string },
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const optimizedBuffer = await optimizeToWebp(file.buffer);
  const safeFilename = withWebpExtension(file.filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
  const path = `${productId}/${safeFilename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, optimizedBuffer, {
      contentType: 'image/webp',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const url = new URL(imageUrl);
  const pathSegments = url.pathname.split('/');
  const bucketIndex = pathSegments.indexOf(BUCKET);
  if (bucketIndex === -1) throw new Error('Invalid image URL');
  const path = pathSegments.slice(bucketIndex + 1).join('/');

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

export async function uploadCourseImage(
  courseId: string,
  file: { buffer: Buffer; filename: string; mimetype: string },
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const optimizedBuffer = await optimizeToWebp(file.buffer);
  const safeFilename = withWebpExtension(file.filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
  const path = `courses/${courseId}/${safeFilename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, optimizedBuffer, {
      contentType: 'image/webp',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteCourseImage(imageUrl: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const url = new URL(imageUrl);
  const pathSegments = url.pathname.split('/');
  const bucketIndex = pathSegments.indexOf(BUCKET);
  if (bucketIndex === -1) throw new Error('Invalid image URL');
  const path = pathSegments.slice(bucketIndex + 1).join('/');

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
