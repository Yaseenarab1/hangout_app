import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/services/supabase/client';
import { PHOTO_BUCKET } from '../types';
import { insertPhotoMetadata } from './photos.service';
import type { HangoutPhoto } from '../types';
import type { ImagePickerAsset } from 'expo-image-picker';

export type UploadProgress = {
  index: number;
  total: number;
  phase: 'resizing' | 'uploading' | 'done' | 'error';
};

export type UploadPhotosParams = {
  hangoutId: string;
  assets: ImagePickerAsset[];
  onProgress?: (p: UploadProgress) => void;
};

export async function uploadPhotos(params: UploadPhotosParams): Promise<HangoutPhoto[]> {
  const { hangoutId, assets, onProgress } = params;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const results: HangoutPhoto[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]!;
    const w = asset.width ?? 1600;
    const h = asset.height ?? 1600;

    onProgress?.({ index: i, total: assets.length, phase: 'resizing' });

    // Full-res: max 1600px on longest side, JPEG 80% (EXIF stripped by re-encode)
    const fullRes = await ImageManipulator.manipulateAsync(
      asset.uri,
      resizeActions(w, h, 1600),
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    // Thumbnail: 400×400 cover crop
    const thumb = await ImageManipulator.manipulateAsync(
      asset.uri,
      thumbnailActions(w, h, 400),
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    );

    const photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const storagePath = `${hangoutId}/${photoId}.jpg`;
    const thumbPath = `${hangoutId}/${photoId}_thumb.jpg`;

    onProgress?.({ index: i, total: assets.length, phase: 'uploading' });

    await uploadFile(fullRes.uri, storagePath, 'image/jpeg');
    await uploadFile(thumb.uri, thumbPath, 'image/jpeg');

    const photo = await insertPhotoMetadata({
      hangoutId,
      uploaderId: auth.user.id,
      storagePath,
      thumbnailPath: thumbPath,
      width: fullRes.width,
      height: fullRes.height,
      sizeBytes: asset.fileSize ?? 0,
      mimeType: 'image/jpeg',
    });

    results.push(photo);
    onProgress?.({ index: i, total: assets.length, phase: 'done' });
  }

  return results;
}

function resizeActions(w: number, h: number, max: number): ImageManipulator.Action[] {
  if (w <= max && h <= max) return [];
  if (w >= h) return [{ resize: { width: max } }];
  return [{ resize: { height: max } }];
}

function thumbnailActions(w: number, h: number, size: number): ImageManipulator.Action[] {
  if (w < h) {
    const newH = Math.round(h * (size / w));
    return [
      { resize: { width: size } },
      {
        crop: {
          originX: 0,
          originY: Math.max(0, Math.round((newH - size) / 2)),
          width: size,
          height: Math.min(size, newH),
        },
      },
    ];
  } else {
    const newW = Math.round(w * (size / h));
    return [
      { resize: { height: size } },
      {
        crop: {
          originX: Math.max(0, Math.round((newW - size) / 2)),
          originY: 0,
          width: Math.min(size, newW),
          height: size,
        },
      },
    ];
  }
}

async function uploadFile(
  localUri: string,
  path: string,
  contentType: string,
): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = decode(base64);
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) {
    console.error('[uploadFile] storage error:', JSON.stringify(error), 'path:', path);
    throw error;
  }
}
