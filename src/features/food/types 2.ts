/**
 * Food-specific types. Cuisine and restaurant options are stored as poll_options
 * with their domain-specific data in the metadata JSONB column.
 */

/** What we store in poll_options.metadata for a cuisine option. */
export type CuisineOptionMetadata = {
  emoji?: string | null;
  catalogId?: string | null; // ID from CUISINE_CATALOG
};

/** What we store in poll_options.metadata for a restaurant option. */
export type RestaurantOptionMetadata = {
  emoji?: string | null;
  /** From Google Places. */
  placeId?: string | null;
  address?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  priceLevel?: number | null;
  primaryType?: string | null;
  mapsUrl?: string | null;
  /** If user added a custom restaurant (not from Google), this is set. */
  isCustom?: boolean;
};

/** Selected option in the cuisine picker. */
export type CuisineOption = {
  id: string;
  label: string;
  emoji?: string;
  catalogId?: string;
};

/** Selected option in the restaurant picker. */
export type RestaurantOption = {
  id: string; // local-only id
  name: string;
  address?: string | null;
  placeId?: string;
  rating?: number | null;
  priceLevel?: number | null;
  primaryType?: string | null;
  mapsUrl?: string | null;
  isCustom?: boolean;
};
