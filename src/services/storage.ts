import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase/client';
import { STORAGE_BUCKETS } from './supabase/tables';
import { logError } from './errors';

/**
 * File storage helpers.
 *
 * Upload pipeline:
 *   1. Process the image (resize, EXIF strip via re-encode) — we use JPEG for reliability.
 *   2. Read the processed file as base64 from the device filesystem.
 *   3. Decode to ArrayBuffer.
 *   4. Upload to Supabase Storage.
 *
 * Why not `fetch(localUri).then(r => r.blob())`? It silently produces empty
 * Blobs on React Native. Read base64 + decode is the reliable pattern.
 */

type Bucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export type UploadResult = {
  storagePath: string;
  publicUrl: string | null;
};

export async function uploadAvatar(localUri: string, userId: string): Promise<UploadResult> {
  const processed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  const path = `${userId}/avatar.jpg`;
  const result = await uploadProcessedFile(
    processed.uri,
    STORAGE_BUCKETS.avatars,
    path,
    'image/jpeg',
  );
  console.log('[uploadAvatar] result:', JSON.stringify(result));
  return result;
}

export async function getPublicUrl(bucket: Bucket, path: string): Promise<string> {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function getSignedUrl(
  bucket: Bucket,
  path: string,
  expiresInSec = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) {
    throw error ?? new Error('Failed to create signed URL');
  }
  return data.signedUrl;
}

export interface FeedPostUploadResult {
  storagePath: string;
  width: number;
  height: number;
}

/** Upload a local image as a feed post. Returns storage path + dimensions. */
export async function uploadFeedPost(
  localUri: string,
  userId: string,
  postId: string,
): Promise<FeedPostUploadResult> {
  // Resize to max 1600px on the long edge, strip EXIF via re-encode, JPEG 80%
  const processed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1600 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );

  const path = `${userId}/${postId}.jpg`;
  await uploadProcessedFile(processed.uri, STORAGE_BUCKETS.feedPosts, path, 'image/jpeg');

  return {
    storagePath: path,
    width: processed.width,
    height: processed.height,
  };
}

async function uploadProcessedFile(
  localUri: string,
  bucket: Bucket,
  path: string,
  contentType: string,
): Promise<UploadResult> {
  try {
    // 1. Read the file as base64 from the device filesystem.
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[uploadProcessedFile] base64 length:', base64.length);

    if (!base64 || base64.length === 0) {
      throw new Error('Read empty file from local URI');
    }

    // 2. Decode to ArrayBuffer (Supabase accepts ArrayBuffer for uploads).
    const arrayBuffer = decode(base64);
    console.log('[uploadProcessedFile] arrayBuffer byteLength:', arrayBuffer.byteLength);

    // 3. Upload to Supabase Storage.
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (uploadError) {
      console.log('[uploadProcessedFile] upload error:', JSON.stringify(uploadError));
      throw uploadError;
    }

    const publicUrl =
      bucket === STORAGE_BUCKETS.avatars ? await getPublicUrl(bucket, path) : null;

    return { storagePath: path, publicUrl };
  } catch (error) {
    console.log('[storage upload error]', JSON.stringify(error, null, 2));
    logError(error, { bucket, path });
    throw error;
  }
}
