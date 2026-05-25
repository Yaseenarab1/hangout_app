export type DayPlanItemType = 'restaurant' | 'activity' | 'custom';

export type PlaceData = {
  name: string;
  address: string;
  rating: number | null;
  priceLevel: number | null;
  photoReference: string | null;
  mapsUrl: string | null;
};

export type DayPlanItem = {
  id: string;
  plan_id: string;
  position: number;
  item_type: DayPlanItemType;
  title: string;
  subtitle: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  place_id: string | null;
  place_data: PlaceData | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type DayPlan = {
  id: string;
  hangout_id: string;
  title: string;
  plan_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DayPlanWithItems = DayPlan & { items: DayPlanItem[] };

export type CreateDayPlanInput = {
  hangoutId: string;
  title?: string;
  planDate?: string | null;
};

export type AddDayPlanItemInput = {
  planId: string;
  itemType: DayPlanItemType;
  title: string;
  subtitle?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  placeId?: string | null;
  placeData?: PlaceData | null;
  notes?: string | null;
};
