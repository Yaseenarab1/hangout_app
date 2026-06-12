export type MovieOption = {
  id: string;          // `tmdb:${tmdbId}`
  tmdbId: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  rating: number | null;
  year: string | null;
  mediaType: 'movie' | 'tv';
  genres: string[];
};
