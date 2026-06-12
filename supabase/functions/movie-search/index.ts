// supabase/functions/movie-search/index.ts
// Proxies TMDB API calls. Keeps TMDB_API_KEY server-side.
//
// Request body (POST):
//   { type: 'now_playing' }
//   { type: 'trending' }
//   { type: 'streaming', provider: 8, media: 'movie' | 'tv' }
//   { type: 'search', q: 'the dark knight' }
//
// Streaming provider IDs: Netflix=8, Hulu=15, Disney+=337, Max=1899,
//   AppleTV+=350, Peacock=386, Paramount+=531

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const TMDB_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MOVIE_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Sci-Fi', 53: 'Thriller', 10752: 'War', 37: 'Western',
};
const TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery',
  10765: 'Sci-Fi & Fantasy', 37: 'Western',
};

function tmdbFetch(path: string) {
  // Use api_key query param — works with the v3 API key from themoviedb.org
  const sep = path.includes('?') ? '&' : '?';
  return fetch(`${TMDB}${path}${sep}api_key=${TMDB_KEY}`);
}

function formatItem(item: Record<string, unknown>, mediaType: 'movie' | 'tv') {
  const genreMap = mediaType === 'movie' ? MOVIE_GENRES : TV_GENRES;
  const genreIds = (item.genre_ids as number[] | undefined) ?? [];
  return {
    tmdbId: item.id as number,
    title: (item.title ?? item.name ?? '') as string,
    overview: (item.overview ?? '') as string,
    posterUrl: item.poster_path ? `${POSTER_BASE}${item.poster_path}` : null,
    rating: item.vote_average ? Number((item.vote_average as number).toFixed(1)) : null,
    year: ((item.release_date ?? item.first_air_date ?? '') as string).slice(0, 4) || null,
    mediaType,
    genres: genreIds.slice(0, 2).map((id) => genreMap[id]).filter(Boolean),
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!TMDB_KEY) throw new Error('TMDB_API_KEY not configured');

    const body = await req.json() as {
      type?: string;
      q?: string;
      provider?: number;
      media?: 'movie' | 'tv';
    };

    const { type = 'now_playing', q = '', provider, media = 'movie' } = body;

    let results: ReturnType<typeof formatItem>[] = [];

    if (type === 'now_playing') {
      const res = await tmdbFetch('/movie/now_playing?region=US&language=en-US&page=1');
      const data = await res.json();
      results = (data.results as Record<string, unknown>[]).map((m) => formatItem(m, 'movie'));
    } else if (type === 'trending') {
      const res = await tmdbFetch('/trending/movie/week?language=en-US');
      const data = await res.json();
      results = (data.results as Record<string, unknown>[]).map((m) => formatItem(m, 'movie'));
    } else if (type === 'streaming' && provider) {
      const endpoint = media === 'tv' ? 'tv' : 'movie';
      const res = await tmdbFetch(
        `/discover/${endpoint}?with_watch_providers=${provider}&watch_region=US&language=en-US&sort_by=popularity.desc&page=1`,
      );
      const data = await res.json();
      results = (data.results as Record<string, unknown>[]).map((m) => formatItem(m, media));
    } else if (type === 'search' && q) {
      const res = await tmdbFetch(`/search/multi?query=${encodeURIComponent(q)}&language=en-US&page=1`);
      const data = await res.json();
      results = (data.results as Record<string, unknown>[])
        .filter((m) => m.media_type === 'movie' || m.media_type === 'tv')
        .map((m) => formatItem(m, (m.media_type as 'movie' | 'tv')));
    }

    return new Response(JSON.stringify({ results: results.slice(0, 20) }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
