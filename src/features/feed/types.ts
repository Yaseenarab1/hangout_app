export type PostVisibility = 'hangout' | 'friends' | 'public';

export type ReactionType = 'heart' | 'fire' | 'laugh' | 'wow' | 'sad' | 'clap';

export interface ReactionDef {
  type: ReactionType;
  emoji: string;
}

export const REACTIONS: ReactionDef[] = [
  { type: 'heart', emoji: '❤️' },
  { type: 'fire', emoji: '🔥' },
  { type: 'laugh', emoji: '😂' },
  { type: 'wow', emoji: '😮' },
  { type: 'sad', emoji: '😢' },
  { type: 'clap', emoji: '👏' },
];

export interface FeedPost {
  id: string;
  author_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  media_paths: string[] | null; // all photo paths (1-4); null = single (use storage_path)
  media_type: 'photo' | 'video';
  duration_ms: number | null; // video duration; null for photos
  width: number;
  height: number;
  caption: string | null;
  visibility: PostVisibility;
  hangout_id: string | null;
  expires_at: string | null;
  linked_hangout_photo_id: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  // joined on fetch
  author?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  like_count?: number;
  comment_count?: number;
  viewer_has_liked?: boolean;
  viewer_reaction?: ReactionType | null;
  // top reactions with counts for the reaction display strip
  top_reactions?: { type: ReactionType; count: number }[];
}

export interface FeedPostWithUrl extends FeedPost {
  image_url: string;    // first/primary signed URL (backward compat)
  image_urls: string[]; // all signed URLs (1-4)
}

export interface FeedPostComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  author?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  viewer_reaction?: ReactionType | null;
  reactions?: { type: ReactionType; count: number }[];
}

export interface CreatePostParams {
  localUris: string[];  // 1–4 photos OR 1 video
  mediaType?: 'photo' | 'video';
  durationMs?: number; // only for video
  caption?: string;
  visibility: PostVisibility;
  hangoutId?: string;
  expiresAt?: string | null; // ISO string, or null for permanent ("keep on profile")
}

// Groups posts by author for story rail display
export interface StoryGroup {
  author: NonNullable<FeedPost['author']>;
  posts: FeedPostWithUrl[];
  hasUnviewed: boolean;
}
