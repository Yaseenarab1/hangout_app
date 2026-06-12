export type PriceHint = 'free' | 'paid' | 'unknown';

export type SportVenueOption = {
  id: string;
  name: string;
  address?: string | null;
  placeId?: string;
  rating?: number | null;
  priceLevel?: number | null;
  primaryType?: string | null;
  mapsUrl?: string | null;
  photos?: string[] | null;
  sportEmoji?: string;
  priceHint: PriceHint;
};
