import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { uploadPhotos, type UploadProgress } from '../services/upload.service';
import { photosKey } from './usePhotos';
import { toast } from '@/stores/ui.store';
import type { ImagePickerAsset } from 'expo-image-picker';

export function useUploadPhoto(hangoutId: string) {
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const upload = useCallback(
    async (assets: ImagePickerAsset[]): Promise<void> => {
      setIsPending(true);
      setProgress(null);
      try {
        await uploadPhotos({ hangoutId, assets, onProgress: setProgress });
        qc.invalidateQueries({ queryKey: photosKey(hangoutId) });
      } catch {
        toast.error('Upload failed. Please try again.');
      } finally {
        setIsPending(false);
        setProgress(null);
      }
    },
    [hangoutId, qc],
  );

  return { upload, isPending, progress };
}
