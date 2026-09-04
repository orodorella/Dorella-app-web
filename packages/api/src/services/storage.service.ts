import { getSupabaseAdmin } from '../config/supabase.js';
import { optimizeToWebp, withWebpExtension, IMMUTABLE_CACHE_CONTROL } from '../utils/image-optimizer.js';

const BUCKET = 'products';

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
