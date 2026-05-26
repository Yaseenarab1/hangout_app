export type AvailabilitySession = {
  id: string;
  created_by: string;
  hangout_id: string | null;
  title: string;
  dates: string[];       // YYYY-MM-DD
  start_hour: number;
  end_hour: number;
  created_at: string;
};

export type AvailabilityResponse = {
  id: string;
  session_id: string;
  user_id: string | null;
  guest_name: string | null;
  available: string[];   // "YYYY-MM-DD:HH" e.g. "2026-05-28:14"
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type SessionWithResponses = AvailabilitySession & {
  responses: AvailabilityResponse[];
};

export type CreateSessionInput = {
  hangoutId?: string;
  title?: string;
  dates: string[];       // YYYY-MM-DD, max 7
  startHour?: number;
  endHour?: number;
};
