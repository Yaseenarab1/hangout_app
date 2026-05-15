export type PostVisibility = 'hangout' | 'friends' | 'public';

export interface FeedPost {
  id: string;
  author_id: string;
  storage_path: string;
  thumbnail_path: string | null;
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
}

export interface FeedPostWithUrl extends FeedPost {
  image_url: string; // signed URL, valid for 1h
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
}

export interface CreatePostParams {
  localUri: string;
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
