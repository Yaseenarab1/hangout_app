import { supabase } from '@/services/supabase/client';
import { TABLES, STORAGE_BUCKETS, QUERY_KEYS } from '@/services/supabase/tables';
import { getSignedUrl, uploadFeedPost } from '@/services/storage';
import type { FeedPost, FeedPostWithUrl, FeedPostComment, CreatePostParams } from '../types';

const SIGNED_URL_TTL = 3600; // 1 hour

const POST_SELECT = `
  *,
  author:profiles!feed_posts_author_id_fkey(id, display_name, username, avatar_url),
  like_count:feed_post_likes(count),
  comment_count:feed_post_comments(count),
  viewer_has_liked:feed_post_likes!inner(user_id)
`;

async function attachSignedUrl(post: FeedPost): Promise<FeedPostWithUrl> {
  const url = await getSignedUrl(STORAGE_BUCKETS.feedPosts, post.storage_path, SIGNED_URL_TTL);
  return { ...post, image_url: url };
}

/** Feed for the current user: posts from friends + own posts, active only. */
export async function getFeedPosts(): Promise<FeedPostWithUrl[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .select(POST_SELECT)
    .is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return Promise.all((data ?? []).map(normalizeAndSign));
}

/** Posts by a specific author (for profile gallery — permanent posts only). */
export async function getAuthorPosts(authorId: string): Promise<FeedPostWithUrl[]> {
  const { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .select(POST_SELECT)
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .is('expires_at', null) // permanent only
    .order('created_at', { ascending: false });

  if (error) throw error;

  return Promise.all((data ?? []).map(normalizeAndSign));
}

/** Active (non-expired) posts for the story rail. Groups by author on client. */
export async function getStoryPosts(): Promise<FeedPostWithUrl[]> {
  const { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .select(POST_SELECT)
    .is('deleted_at', null)
    .not('expires_at', 'is', null) // ephemeral only
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  return Promise.all((data ?? []).map(normalizeAndSign));
}

/** Create a new feed post: upload image then insert row. */
export async function createFeedPost(params: CreatePostParams): Promise<FeedPost> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const userId = auth.user.id;

  // Generate post ID client-side so we can use it for the storage path
  const postId = crypto.randomUUID();

  const { storagePath, width, height } = await uploadFeedPost(params.localUri, userId, postId);

  const row = {
    id: postId,
    author_id: userId,
    storage_path: storagePath,
    thumbnail_path: null,
    width,
    height,
    caption: params.caption ?? null,
    visibility: params.visibility,
    hangout_id: params.hangoutId ?? null,
    expires_at:
      params.expiresAt === undefined
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // default 24h
        : params.expiresAt, // null = permanent
  };

  const { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as FeedPost;
}

/** Soft-delete: sets deleted_at. Author only (enforced by RLS). */
export async function deleteFeedPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.feed_posts as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) throw error;
}

// ── Likes ──────────────────────────────────────────────────────────────────

export async function likePost(postId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from(TABLES.feed_post_likes as any)
    .insert({ post_id: postId, user_id: auth.user.id });

  if (error && error.code !== '23505') throw error; // ignore duplicate
}

export async function unlikePost(postId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from(TABLES.feed_post_likes as any)
    .delete()
    .eq('post_id', postId)
    .eq('user_id', auth.user.id);

  if (error) throw error;
}

// ── Comments ───────────────────────────────────────────────────────────────

export async function getComments(postId: string): Promise<FeedPostComment[]> {
  const { data, error } = await supabase
    .from(TABLES.feed_post_comments as any)
    .select('*, author:profiles!feed_post_comments_user_id_fkey(id, display_name, username, avatar_url)')
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as FeedPostComment[];
}

export async function createComment(postId: string, body: string): Promise<FeedPostComment> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from(TABLES.feed_post_comments as any)
    .insert({ post_id: postId, user_id: auth.user.id, body })
    .select('*, author:profiles!feed_post_comments_user_id_fkey(id, display_name, username, avatar_url)')
    .single();

  if (error) throw error;
  return data as unknown as FeedPostComment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.feed_post_comments as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) throw error;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function normalizeAndSign(raw: any): Promise<FeedPostWithUrl> {
  const post: FeedPost = {
    ...raw,
    // Supabase returns count as [{count: n}] — flatten
    like_count: raw.like_count?.[0]?.count ?? 0,
    comment_count: raw.comment_count?.[0]?.count ?? 0,
    viewer_has_liked: (raw.viewer_has_liked?.length ?? 0) > 0,
  };
  return attachSignedUrl(post);
}
