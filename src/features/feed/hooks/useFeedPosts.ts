import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/services/supabase/client';
import { QUERY_KEYS } from '@/services/supabase/tables';
import { useSession } from '@/features/auth';
import { getFeedPosts, getStoryPosts, getAuthorPosts, getAuthorAllPosts } from '../services/feed.service';
import type { FeedPostWithUrl } from '../types';

export function useFeedPosts() {
  const qc = useQueryClient();
  const { user } = useSession();

  const query = useQuery({
    queryKey: QUERY_KEYS.feedPosts(),
    queryFn: getFeedPosts,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  });

  // Realtime: invalidate when a new post is inserted into feed_posts
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`feed:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_posts',
        },
        () => {
          qc.invalidateQueries({ queryKey: QUERY_KEYS.feedPosts() });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return query;
}

export function useStoryPosts() {
  const { user } = useSession();
  return useQuery({
    queryKey: [...QUERY_KEYS.feedPosts(), 'stories'],
    queryFn: getStoryPosts,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // stories expire, refresh every minute
  });
}

/** Permanent posts only (profile gallery). */
export function useAuthorPosts(authorId: string | undefined) {
  return useQuery({
    queryKey: authorId ? QUERY_KEYS.feedPosts(authorId) : ['feed', 'posts', 'noop'],
    queryFn: () => (authorId ? getAuthorPosts(authorId) : Promise.resolve<FeedPostWithUrl[]>([])),
    enabled: Boolean(authorId),
    staleTime: 60 * 1000,
  });
}

/** Permanent + active ephemeral posts (own profile — shows everything). */
export function useAuthorAllPosts(authorId: string | undefined) {
  return useQuery({
    queryKey: authorId ? [...QUERY_KEYS.feedPosts(authorId), 'all'] : ['feed', 'posts', 'noop'],
    queryFn: () => (authorId ? getAuthorAllPosts(authorId) : Promise.resolve<FeedPostWithUrl[]>([])),
    enabled: Boolean(authorId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // ephemeral posts expire, keep fresh
  });
}
