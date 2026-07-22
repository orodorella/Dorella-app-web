import { getSupabaseAdmin } from '../config/supabase.js';

const BUCKET = 'products';

export async function uploadProductImage(
  productId: string,
  file: { buffer: Buffer; filename: string; mimetype: string },
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const path = `${productId}/${file.filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
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
  const path = pathSegments.slice(bucketIndex).join('/');

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

export async function uploadCourseImage(
  courseId: string,
  file: { buffer: Buffer; filename: string; mimetype: string },
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const path = `courses/${courseId}/${file.filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
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
  const path = pathSegments.slice(bucketIndex).join('/');

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
