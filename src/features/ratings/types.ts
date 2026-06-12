export type RestaurantRating = {
  id: string;
  user_id: string;
  place_id: string;
  place_name: string;
  place_address: string | null;
  place_photo: string | null;
  place_type: string | null;
  rating: 1 | 2 | 3 | 4 | 5;
  notes: string | null;
  visited_at: string;
  created_at: string;
  updated_at: string;
};

export type UpsertRatingInput = {
  place_id: string;
  place_name: string;
  place_address?: string | null;
  place_photo?: string | null;
  place_type?: string | null;
  rating: 1 | 2 | 3 | 4 | 5;
  notes?: string | null;
  visited_at?: string;
};

export type RatablePlace = {
  place_id: string;
  place_name: string;
  place_address?: string | null;
  place_photo?: string | null;
  place_type?: string | null;
};

export type PlaceCompatibility = {
  place_id: string;
  raterCount: number;
  avgRating: number;
  myRating: number | null;
};

export type HangoutPlace = {
  name: string;
  place_id: string | null;
  address: string | null;
  primary_type: string | null;
  hangout_title: string;
  hangout_id: string;
};

export const STAR_LABELS: Record<number, string> = {
  1: 'Not worth it',
  2: "It's ok",
  3: 'Solid',
  4: 'Really good',
  5: 'Must go!',
};
