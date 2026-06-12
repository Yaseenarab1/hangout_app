import { supabase } from '@/services/supabase/client';
import { TABLES, STORAGE_BUCKETS, QUERY_KEYS } from '@/services/supabase/tables';
import { getSignedUrl, uploadFeedPost, uploadFeedVideo } from '@/services/storage';
import type { FeedPost, FeedPostWithUrl, FeedPostComment, CreatePostParams, ReactionType } from '../types';

const SIGNED_URL_TTL = 3600; // 1 hour

// crypto.randomUUID() is not available in Hermes — use Math.random() fallback
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const POST_SELECT = `
  *,
  author:profiles!feed_posts_author_id_fkey(id, display_name, username, avatar_url),
  like_count:feed_post_likes(count),
  comment_count:feed_post_comments(count),
  all_reactions:feed_post_likes(user_id)
`;

/** Feed for the current user: posts from friends + own posts, active only. */
export async function getFeedPosts(): Promise<FeedPostWithUrl[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const viewerId = auth.user.id;

  const { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .select(POST_SELECT)
    .is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  const results = await Promise.all((data ?? []).map((raw) => normalizeAndSign(raw, viewerId)));
  return results.filter((p): p is FeedPostWithUrl => p !== null);
}

/** Posts by a specific author (for profile gallery — permanent posts only). */
export async function getAuthorPosts(authorId: string): Promise<FeedPostWithUrl[]> {
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id ?? '';

  const { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .select(POST_SELECT)
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .is('expires_at', null) // permanent only
    .order('created_at', { ascending: false });

  if (error) throw error;

  const results = await Promise.all((data ?? []).map((raw) => normalizeAndSign(raw, viewerId)));
  return results.filter((p): p is FeedPostWithUrl => p !== null);
}

/** All active posts by an author (permanent + non-expired ephemeral). */
export async function getAuthorAllPosts(authorId: string): Promise<FeedPostWithUrl[]> {
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id ?? '';

  const { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .select(POST_SELECT)
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const results = await Promise.all((data ?? []).map((raw) => normalizeAndSign(raw, viewerId)));
  return results.filter((p): p is FeedPostWithUrl => p !== null);
}

/** Ephemeral posts only — for internal use. */
export async function getStoryPosts(): Promise<FeedPostWithUrl[]> {
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id ?? '';

  const { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .select(POST_SELECT)
    .is('deleted_at', null)
    .not('expires_at', 'is', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  const results = await Promise.all((data ?? []).map((raw) => normalizeAndSign(raw, viewerId)));
  return results.filter((p): p is FeedPostWithUrl => p !== null);
}

/** Create a new feed post: upload 1–4 photos (or 1 video) then insert row. */
export async function createFeedPost(params: CreatePostParams): Promise<FeedPost> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const userId = auth.user.id;

  const uris = params.localUris.slice(0, 4);
  if (uris.length === 0) throw new Error('At least one media item required');

  const isVideo = params.mediaType === 'video';
  const postId = generateUUID();

  let storagePath: string;
  let width = 0;
  let height = 0;
  let mediaPaths: string[];

  if (isVideo) {
    const result = await uploadFeedVideo(uris[0]!, userId, postId);
    storagePath = result.storagePath;
    mediaPaths = [storagePath];
  } else {
    // Upload photos sequentially — parallel uploads to the same folder cause a silent
    // race condition in Supabase Storage where only the first file lands.
    const uploads: Awaited<ReturnType<typeof uploadFeedPost>>[] = [];
    for (let i = 0; i < uris.length; i++) {
      const result = await uploadFeedPost(uris[i]!, userId, postId, i);
      uploads.push(result);
    }
    storagePath = uploads[0]!.storagePath;
    width = uploads[0]!.width;
    height = uploads[0]!.height;
    mediaPaths = uploads.map((u) => u.storagePath);
  }

  const baseRow = {
    id: postId,
    author_id: userId,
    storage_path: storagePath,
    thumbnail_path: null,
    media_type: isVideo ? 'video' : 'photo',
    duration_ms: isVideo ? (params.durationMs ?? null) : null,
    width,
    height,
    caption: params.caption ?? null,
    visibility: params.visibility,
    hangout_id: params.hangoutId ?? null,
    expires_at:
      params.expiresAt === undefined
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : params.expiresAt,
  };

  // Try with media_paths first; fall back gracefully if column doesn't exist yet
  let { data, error } = await supabase
    .from(TABLES.feed_posts as any)
    .insert({ ...baseRow, media_paths: mediaPaths })
    .select()
    .single();

  // 42703 = PostgreSQL "undefined_column" — media_paths not yet in DB schema
  if (error?.code === '42703' || error?.message?.includes('media_paths')) {
    const retry = await supabase
      .from(TABLES.feed_posts as any)
      .insert(baseRow)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

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

/** Make an ephemeral post permanent (set expires_at = null). Author only via RLS. */
export async function makePostPermanent(postId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.feed_posts as any)
    .update({ expires_at: null })
    .eq('id', postId);

  if (error) throw error;
}

// ── Reactions ──────────────────────────────────────────────────────────────

/** Upsert a reaction. If same type already set, removes it (toggle). */
export async function reactToPost(
  postId: string,
  reactionType: ReactionType,
  currentReaction: ReactionType | null,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  if (currentReaction === reactionType) {
    // Toggle off — remove reaction
    await supabase
      .from(TABLES.feed_post_likes as any)
      .delete()
      .eq('post_id', postId)
      .eq('user_id', auth.user.id);
    return;
  }

  // Upsert (inserts or changes reaction type)
  const { error } = await supabase
    .from(TABLES.feed_post_likes as any)
    .upsert(
      { post_id: postId, user_id: auth.user.id, reaction_type: reactionType },
      { onConflict: 'post_id,user_id' },
    );
  if (error) throw error;
}

export async function removePostReaction(postId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from(TABLES.feed_post_likes as any)
    .delete()
    .eq('post_id', postId)
    .eq('user_id', auth.user.id);
  if (error) throw error;
}

// kept for backward compat with useLikePost hook
export async function likePost(postId: string): Promise<void> {
  return reactToPost(postId, 'heart', null);
}

export async function unlikePost(postId: string): Promise<void> {
  return removePostReaction(postId);
}

// ── Comment reactions ───────────────────────────────────────────────────────

export async function reactToComment(
  commentId: string,
  reactionType: ReactionType,
  currentReaction: ReactionType | null,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  if (currentReaction === reactionType) {
    await supabase
      .from(TABLES.feed_comment_reactions as any)
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', auth.user.id);
    return;
  }

  const { error } = await supabase
    .from(TABLES.feed_comment_reactions as any)
    .upsert(
      { comment_id: commentId, user_id: auth.user.id, reaction_type: reactionType },
      { onConflict: 'comment_id,user_id' },
    );
  if (error) throw error;
}

// ── Comments ───────────────────────────────────────────────────────────────

export async function getComments(postId: string): Promise<FeedPostComment[]> {
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id ?? '';

  const { data, error } = await supabase
    .from(TABLES.feed_post_comments as any)
    .select(`
      *,
      author:profiles!feed_post_comments_user_id_fkey(id, display_name, username, avatar_url)
    `)
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as any[]).map((raw) => ({
    ...raw,
    viewer_reaction: null,
    reactions: [],
  })) as unknown as FeedPostComment[];
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

async function normalizeAndSign(raw: any, viewerId: string): Promise<FeedPostWithUrl | null> {
  const paths: string[] =
    Array.isArray(raw.media_paths) && raw.media_paths.length > 0
      ? raw.media_paths
      : raw.storage_path ? [raw.storage_path] : [];

  if (paths.length === 0) return null;

  const signed = await Promise.all(
    paths.map((p) =>
      getSignedUrl(STORAGE_BUCKETS.feedPosts, p, SIGNED_URL_TTL).catch(() => null),
    ),
  );
  const image_urls = signed.filter((u): u is string => u !== null);
  if (image_urls.length === 0) return null; // file missing or no access — skip post

  // all_reactions rows may or may not have reaction_type (depends on migration state)
  const allReactions: { user_id: string; reaction_type?: string }[] = raw.all_reactions ?? [];
  const myReactionRow = allReactions.find((r) => r.user_id === viewerId);
  const myReaction = (myReactionRow?.reaction_type ?? (myReactionRow ? 'heart' : null)) as ReactionType | null;

  const countMap = new Map<string, number>();
  for (const r of allReactions) {
    const t = r.reaction_type ?? 'heart';
    countMap.set(t, (countMap.get(t) ?? 0) + 1);
  }
  const top_reactions = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => ({ type: type as ReactionType, count }));

  const post: FeedPost = {
    ...raw,
    like_count: raw.like_count?.[0]?.count ?? 0,
    comment_count: raw.comment_count?.[0]?.count ?? 0,
    viewer_has_liked: !!myReaction,
    viewer_reaction: myReaction,
    top_reactions,
  };

  return {
    ...post,
    image_url: image_urls[0]!,
    image_urls,
  };
}
