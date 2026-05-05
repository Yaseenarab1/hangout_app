/**
 * Static cuisine catalog. Same pattern as activities.
 *
 * Used for cuisine polls. When a user picks a cuisine here and the poll
 * winner is decided, the cuisine name is also passed to Google Places as
 * a search query for the optional restaurant follow-up poll.
 */

export type CuisineCategoryId =
  | 'asian'
  | 'european'
  | 'latin'
  | 'middle_east'
  | 'american'
  | 'fusion';

export type CuisineCatalogItem = {
  id: string;
  /** Display label shown in the picker. */
  label: string;
  /** Emoji prefix. */
  emoji: string;
  /** Category for grouping/coloring. */
  category: CuisineCategoryId;
  /**
   * Search hint passed to Google Places when used for restaurant search.
   * Usually the same as label, but can be tuned for better Google results.
   */
  searchHint?: string;
};

export const CUISINE_CATALOG: CuisineCatalogItem[] = [
  // Asian
  { id: 'japanese', label: 'Japanese', emoji: '🍣', category: 'asian' },
  { id: 'sushi', label: 'Sushi', emoji: '🍣', category: 'asian' },
  { id: 'ramen', label: 'Ramen', emoji: '🍜', category: 'asian' },
  { id: 'chinese', label: 'Chinese', emoji: '🥡', category: 'asian' },
  { id: 'korean', label: 'Korean', emoji: '🌶️', category: 'asian', searchHint: 'Korean BBQ' },
  { id: 'thai', label: 'Thai', emoji: '🍲', category: 'asian' },
  { id: 'vietnamese', label: 'Vietnamese', emoji: '🍜', category: 'asian' },
  { id: 'indian', label: 'Indian', emoji: '🍛', category: 'asian' },

  // European
  { id: 'italian', label: 'Italian', emoji: '🍝', category: 'european' },
  { id: 'pizza', label: 'Pizza', emoji: '🍕', category: 'european' },
  { id: 'french', label: 'French', emoji: '🥖', category: 'european' },
  { id: 'spanish', label: 'Spanish', emoji: '🥘', category: 'european' },
  { id: 'greek', label: 'Greek', emoji: '🥙', category: 'european' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🫒', category: 'european' },

  // Latin
  { id: 'mexican', label: 'Mexican', emoji: '🌮', category: 'latin' },
  { id: 'tex_mex', label: 'Tex-Mex', emoji: '🌯', category: 'latin' },
  { id: 'peruvian', label: 'Peruvian', emoji: '🍤', category: 'latin' },
  { id: 'brazilian', label: 'Brazilian', emoji: '🥩', category: 'latin' },
  { id: 'cuban', label: 'Cuban', emoji: '🥪', category: 'latin' },

  // Middle East
  { id: 'lebanese', label: 'Lebanese', emoji: '🥙', category: 'middle_east' },
  { id: 'turkish', label: 'Turkish', emoji: '🥙', category: 'middle_east' },
  { id: 'falafel', label: 'Falafel', emoji: '🧆', category: 'middle_east' },

  // American
  { id: 'burger', label: 'Burgers', emoji: '🍔', category: 'american' },
  { id: 'bbq', label: 'BBQ', emoji: '🍖', category: 'american' },
  { id: 'steakhouse', label: 'Steakhouse', emoji: '🥩', category: 'american' },
  { id: 'soul_food', label: 'Soul food', emoji: '🍗', category: 'american' },
  { id: 'diner', label: 'Diner', emoji: '🍳', category: 'american' },
  { id: 'seafood', label: 'Seafood', emoji: '🦐', category: 'american' },

  // Fusion / other
  { id: 'fusion', label: 'Fusion', emoji: '✨', category: 'fusion', searchHint: 'fusion restaurant' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱', category: 'fusion' },
  { id: 'cafe', label: 'Cafe', emoji: '☕', category: 'fusion' },
  { id: 'bakery', label: 'Bakery', emoji: '🥐', category: 'fusion' },
];

export const CUISINE_CATEGORIES: {
  id: CuisineCategoryId;
  label: string;
  color: string;
}[] = [
  { id: 'asian', label: 'Asian', color: '#EF4444' },        // red
  { id: 'european', label: 'European', color: '#F59E0B' },  // amber
  { id: 'latin', label: 'Latin', color: '#10B981' },        // emerald
  { id: 'middle_east', label: 'Middle Eastern', color: '#8B5CF6' }, // violet
  { id: 'american', label: 'American', color: '#3B82F6' },  // blue
  { id: 'fusion', label: 'Fusion / Other', color: '#EC4899' }, // pink
];

export function findCuisineItem(id: string): CuisineCatalogItem | undefined {
  return CUISINE_CATALOG.find((c) => c.id === id);
}

export function getCuisineCategoryColor(id: CuisineCategoryId): string {
  return CUISINE_CATEGORIES.find((c) => c.id === id)?.color ?? '#888888';
}
