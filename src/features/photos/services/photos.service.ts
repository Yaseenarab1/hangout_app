import { supabase } from '@/services/supabase/client';
import { PHOTO_PAGE_SIZE, PHOTO_BUCKET } from '../types';
import type { HangoutPhoto, PhotoReaction } from '../types';

const db = () => supabase as any;

export async function fetchPhotos(
  hangoutId: string,
  cursor?: string,
): Promise<HangoutPhoto[]> {
  let query = db()
    .from('hangout_photos')
    .select(`
      id, hangout_id, uploader_id, storage_path, thumbnail_path,
      width, height, size_bytes, mime_type, caption, taken_at, created_at,
      uploader:profiles!hangout_photos_uploader_id_fkey(id, display_name, avatar_url)
    `)
    .eq('hangout_id', hangoutId)
    .order('created_at', { ascending: false })
    .limit(PHOTO_PAGE_SIZE);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) {
    console.error('[fetchPhotos] error:', JSON.stringify(error));
    throw error;
  }

  const photos: HangoutPhoto[] = data ?? [];
  if (photos.length === 0) return photos;

  // Batch-sign thumbnail + full-res URLs in one request
  const thumbPaths = photos
    .filter((p) => p.thumbnail_path)
    .map((p) => p.thumbnail_path as string);
  const fullPaths = photos.map((p) => p.storage_path);
  const allPaths = [...new Set([...thumbPaths, ...fullPaths])];

  const { data: urls } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(allPaths, 3600);

  if (urls) {
    const urlMap = new Map(
      urls.filter((u) => u.signedUrl).map((u) => [u.path, u.signedUrl]),
    );
    for (const photo of photos) {
      photo.thumbnailSignedUrl = urlMap.get(photo.thumbnail_path ?? '') ?? undefined;
      photo.signedUrl = urlMap.get(photo.storage_path) ?? undefined;
    }
  }

  return photos;
}

export async function insertPhotoMetadata(params: {
  hangoutId: string;
  uploaderId: string;
  storagePath: string;
  thumbnailPath: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  caption?: string | null;
}): Promise<HangoutPhoto> {
  const { data, error } = await db()
    .from('hangout_photos')
    .insert({
      hangout_id: params.hangoutId,
      uploader_id: params.uploaderId,
      storage_path: params.storagePath,
      thumbnail_path: params.thumbnailPath,
      width: params.width,
      height: params.height,
      size_bytes: params.sizeBytes,
      mime_type: params.mimeType,
      caption: params.caption ?? null,
    })
    .select(`
      id, hangout_id, uploader_id, storage_path, thumbnail_path,
      width, height, size_bytes, mime_type, caption, taken_at, created_at,
      uploader:profiles!hangout_photos_uploader_id_fkey(id, display_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return { ...data, reactions: [] };
}

export async function deletePhotoRow(photoId: string): Promise<void> {
  const { error } = await db()
    .from('hangout_photos')
    .delete()
    .eq('id', photoId);
  if (error) throw error;
}

export async function updatePhotoCaption(
  photoId: string,
  caption: string,
): Promise<void> {
  const { error } = await db()
    .from('hangout_photos')
    .update({ caption: caption.trim() || null })
    .eq('id', photoId);
  if (error) throw error;
}

export async function fetchPhotoReactions(photoId: string): Promise<PhotoReaction[]> {
  const { data, error } = await db()
    .from('photo_reactions')
    .select('photo_id, user_id, emoji, created_at')
    .eq('photo_id', photoId);
  if (error) throw error;
  return data ?? [];
}

export async function addPhotoReaction(
  photoId: string,
  emoji: string,
): Promise<PhotoReaction> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await db()
    .from('photo_reactions')
    .insert({ photo_id: photoId, user_id: auth.user.id, emoji })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removePhotoReaction(
  photoId: string,
  emoji: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await db()
    .from('photo_reactions')
    .delete()
    .eq('photo_id', photoId)
    .eq('user_id', auth.user.id)
    .eq('emoji', emoji);
  if (error) throw error;
}

export async function getPhotoSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) throw error ?? new Error('Failed to sign URL');
  return data.signedUrl;
}
