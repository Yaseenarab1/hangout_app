/**
 * Types for Google Places integration. Mirror what our Edge Functions return.
 */

export type PlaceLocation = { lat: number; lng: number };

/**
 * A restaurant or other place returned from places-search or places-details.
 * Pruned and renamed from Google's verbose response in the Edge Function.
 */
export type Place = {
  placeId: string;
  name: string;
  address: string;
  location: PlaceLocation | null;
  rating: number | null;
  ratingCount: number | null;
  /** 0-4: 0=free, 1=cheap ($), 2=moderate ($$), 3=expensive ($$$), 4=very ($$$$) */
  priceLevel: number | null;
  /** "Italian restaurant", "Cafe", etc. */
  primaryType: string | null;
  /** Up to 5 Google photo resource names; build URLs via getPlacePhotoUrl(). */
  photos: string[] | null;
  /** Direct link to Google Maps. */
  mapsUrl: string | null;
  types: string[];
};

/** A more detailed place — includes hours, phone, website. */
export type PlaceDetails = Place & {
  website: string | null;
  phone: string | null;
  openingHours: string[] | null;
  isOpenNow: boolean | null;
};

/** A single autocomplete prediction. */
export type AutocompletePrediction = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
};

/** Filters for restaurant search. */
export type RestaurantSearchFilters = {
  query?: string;
  cuisine?: string;
  /** Search center; defaults to NYC server-side. */
  location?: PlaceLocation;
  /** Meters. Default 5000 = ~3 miles. */
  radius?: number;
  minPriceLevel?: number;
  maxPriceLevel?: number;
  minRating?: number;
};
