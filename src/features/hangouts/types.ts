/**
 * Hangout-related types.
 *
 * If `pnpm db:types` (or the manual gen-types command) ran successfully,
 * these types should already be in `src/services/supabase/types.gen.ts`
 * and we just re-export them. If not, this file defines them.
 *
 * To check: `grep "hangouts:" src/services/supabase/types.gen.ts`
 * If you see a result, you can simplify this file to just re-exports.
 * If not, the explicit definitions below give us a safe fallback.
 */

export type HangoutStatus =
  | 'planning'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ParticipantStatus =
  | 'invited'
  | 'accepted'
  | 'declined'
  | 'maybe'
  | 'removed';

export type ParticipantRole = 'host' | 'co_host' | 'guest';

/** A row from public.hangouts. */
export type Hangout = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  status: HangoutStatus;
  start_time: string | null;
  end_time: string | null;
  primary_location_name: string | null;
  primary_location_address: string | null;
  primary_location_geo: unknown; // PostGIS geography — opaque to JS
  cover_photo_url: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
};

/** A row from public.hangout_participants, plus optional joined profile. */
export type HangoutParticipant = {
  hangout_id: string;
  user_id: string;
  status: ParticipantStatus;
  role: ParticipantRole;
  invited_by: string | null;
  invited_at: string;
  responded_at: string | null;
  vote_weight: number;
  notifications_muted: boolean;
};

/** A hangout joined with its participants and host's profile. */
export type HangoutWithParticipants = Hangout & {
  participants: (HangoutParticipant & {
    profile: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
    };
  })[];
};
