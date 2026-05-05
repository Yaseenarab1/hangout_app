import type { ActivityCatalogItem } from '../types';

/**
 * Static catalog of activity ideas, with optional `placesQuery` mapping each
 * activity to a Google Places search type for the "find what to do AND where"
 * flow.
 */
export const ACTIVITY_CATALOG: (ActivityCatalogItem & {
  placesQuery?: string;
})[] = [
  // --- Social / nightlife ---
  { id: 'bar', label: 'Hit a bar', emoji: '🍻', category: 'social', placesQuery: 'bar' },
  { id: 'cocktails', label: 'Cocktails somewhere nice', emoji: '🍸', category: 'social', placesQuery: 'cocktail bar' },
  { id: 'club', label: 'Go clubbing', emoji: '💃', category: 'social', placesQuery: 'nightclub' },
  { id: 'live_music', label: 'Live music', emoji: '🎸', category: 'social', placesQuery: 'live music venue' },
  { id: 'jazz', label: 'Jazz club', emoji: '🎷', category: 'social', placesQuery: 'jazz club' },
  { id: 'karaoke', label: 'Karaoke', emoji: '🎤', category: 'social', placesQuery: 'karaoke bar' },
  { id: 'comedy', label: 'Comedy show', emoji: '🎭', category: 'social', placesQuery: 'comedy club' },
  { id: 'trivia', label: 'Trivia night', emoji: '🧠', category: 'social', placesQuery: 'trivia bar' },

  // --- Active / games ---
  { id: 'bowling', label: 'Bowling', emoji: '🎳', category: 'active', placesQuery: 'bowling alley' },
  { id: 'pool', label: 'Pool / billiards', emoji: '🎱', category: 'active', placesQuery: 'pool hall' },
  { id: 'arcade', label: 'Arcade', emoji: '🕹️', category: 'active', placesQuery: 'arcade' },
  { id: 'mini_golf', label: 'Mini golf', emoji: '⛳', category: 'active', placesQuery: 'mini golf' },
  { id: 'darts', label: 'Darts', emoji: '🎯', category: 'active', placesQuery: 'darts bar' },
  { id: 'escape_room', label: 'Escape room', emoji: '🧩', category: 'active', placesQuery: 'escape room' },
  { id: 'rock_climbing', label: 'Rock climbing', emoji: '🧗', category: 'active', placesQuery: 'rock climbing gym' },

  // --- Chill / at home ---
  { id: 'movie_at_home', label: 'Movie at home', emoji: '📺', category: 'chill' },
  { id: 'board_games', label: 'Board games', emoji: '🎲', category: 'chill' },
  { id: 'video_games', label: 'Video games', emoji: '🎮', category: 'chill' },
  { id: 'cook_together', label: 'Cook together', emoji: '🍳', category: 'chill' },
  { id: 'wine_night', label: 'Wine night', emoji: '🍷', category: 'chill' },

  // --- Culture ---
  { id: 'movie_theater', label: 'Movie theater', emoji: '🎬', category: 'culture', placesQuery: 'movie theater' },
  { id: 'museum', label: 'Museum', emoji: '🖼️', category: 'culture', placesQuery: 'museum' },
  { id: 'concert', label: 'Concert', emoji: '🎤', category: 'culture', placesQuery: 'concert venue' },
  { id: 'theater', label: 'Theater / play', emoji: '🎭', category: 'culture', placesQuery: 'theater' },
  { id: 'art_gallery', label: 'Art gallery', emoji: '🎨', category: 'culture', placesQuery: 'art gallery' },

  // --- Outdoors ---
  { id: 'park', label: 'Hang at the park', emoji: '🌳', category: 'outdoors', placesQuery: 'park' },
  { id: 'hike', label: 'Go for a hike', emoji: '🥾', category: 'outdoors', placesQuery: 'hiking trail' },
  { id: 'beach', label: 'Beach day', emoji: '🏖️', category: 'outdoors', placesQuery: 'beach' },
  { id: 'picnic', label: 'Picnic', emoji: '🧺', category: 'outdoors', placesQuery: 'park' },
  { id: 'walk', label: 'Long walk + talk', emoji: '🚶', category: 'outdoors' },

  // --- Food-adjacent ---
  { id: 'coffee', label: 'Coffee shop hangout', emoji: '☕', category: 'food_adjacent', placesQuery: 'coffee shop' },
  { id: 'brunch', label: 'Brunch', emoji: '🥞', category: 'food_adjacent', placesQuery: 'brunch restaurant' },
  { id: 'dinner_out', label: 'Dinner out', emoji: '🍽️', category: 'food_adjacent', placesQuery: 'restaurant' },
  { id: 'dessert', label: 'Dessert run', emoji: '🍰', category: 'food_adjacent', placesQuery: 'dessert' },
];

export const ACTIVITY_CATEGORIES: {
  id: ActivityCatalogItem['category'];
  label: string;
  color: string;
}[] = [
  { id: 'social', label: 'Social', color: '#A855F7' },
  { id: 'active', label: 'Active', color: '#10B981' },
  { id: 'chill', label: 'Chill', color: '#3B82F6' },
  { id: 'culture', label: 'Culture', color: '#F59E0B' },
  { id: 'outdoors', label: 'Outdoors', color: '#22C55E' },
  { id: 'food_adjacent', label: 'Food', color: '#EF4444' },
];

export function findCatalogItem(
  id: string,
): (ActivityCatalogItem & { placesQuery?: string }) | undefined {
  return ACTIVITY_CATALOG.find((item) => item.id === id);
}

export function getCategoryColor(
  categoryId: ActivityCatalogItem['category'],
): string {
  return ACTIVITY_CATEGORIES.find((c) => c.id === categoryId)?.color ?? '#888888';
}
