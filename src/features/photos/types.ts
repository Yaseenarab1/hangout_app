export type HangoutPhoto = {
  id: string;
  hangout_id: string;
  uploader_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  width: number;
  height: number;
  size_bytes: number;
  mime_type: string;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  uploader?: { id: string; display_name: string; avatar_url: string | null };
  reactions?: PhotoReaction[];
  // Hydrated after fetch — not stored in DB
  thumbnailSignedUrl?: string;
  signedUrl?: string;
};

export type PhotoReaction = {
  photo_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export const PHOTO_PAGE_SIZE = 50;
export const PHOTO_BUCKET = 'hangout-photos';
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
