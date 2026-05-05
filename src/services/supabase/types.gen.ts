export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      album_photos: {
        Row: {
          album_id: string
          caption: string | null
          created_at: string | null
          deleted_at: string | null
          height: number | null
          id: string
          storage_path: string
          thumbnail_path: string
          uploader_id: string
          width: number | null
        }
        Insert: {
          album_id: string
          caption?: string | null
          created_at?: string | null
          deleted_at?: string | null
          height?: number | null
          id?: string
          storage_path: string
          thumbnail_path: string
          uploader_id: string
          width?: number | null
        }
        Update: {
          album_id?: string
          caption?: string | null
          created_at?: string | null
          deleted_at?: string | null
          height?: number | null
          id?: string
          storage_path?: string
          thumbnail_path?: string
          uploader_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "album_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_photos_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          created_at: string | null
          hangout_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          hangout_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          hangout_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: true
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          created_at: string | null
          ends_at: string
          id: string
          note: string | null
          starts_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["calendar_visibility"]
        }
        Insert: {
          created_at?: string | null
          ends_at: string
          id?: string
          note?: string | null
          starts_at: string
          user_id: string
          visibility?: Database["public"]["Enums"]["calendar_visibility"]
        }
        Update: {
          created_at?: string | null
          ends_at?: string
          id?: string
          note?: string | null
          starts_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["calendar_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_splits: {
        Row: {
          amount_cents: number
          bill_id: string
          debtor_id: string
          id: string
          settled_at: string | null
        }
        Insert: {
          amount_cents: number
          bill_id: string
          debtor_id: string
          id?: string
          settled_at?: string | null
        }
        Update: {
          amount_cents?: number
          bill_id?: string
          debtor_id?: string
          id?: string
          settled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_splits_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_splits_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          added_by: string
          amount_cents: number
          created_at: string | null
          currency: string
          deleted_at: string | null
          description: string
          hangout_id: string
          id: string
          occurred_at: string | null
          ocr_data: Json | null
          paid_by: string
          receipt_storage_path: string | null
        }
        Insert: {
          added_by: string
          amount_cents: number
          created_at?: string | null
          currency?: string
          deleted_at?: string | null
          description: string
          hangout_id: string
          id?: string
          occurred_at?: string | null
          ocr_data?: Json | null
          paid_by: string
          receipt_storage_path?: string | null
        }
        Update: {
          added_by?: string
          amount_cents?: number
          created_at?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          hangout_id?: string
          id?: string
          occurred_at?: string | null
          ocr_data?: Json | null
          paid_by?: string
          receipt_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_visibility_allowlist: {
        Row: {
          created_at: string | null
          user_id: string
          visible_to_user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
          visible_to_user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
          visible_to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_visibility_allowlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_visibility_allowlist_visible_to_user_id_fkey"
            columns: ["visible_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string | null
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string | null
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string | null
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hangout_participants: {
        Row: {
          hangout_id: string
          invited_at: string | null
          invited_by: string | null
          notifications_muted: boolean
          responded_at: string | null
          role: Database["public"]["Enums"]["participant_role"]
          status: Database["public"]["Enums"]["participant_status"]
          user_id: string
          vote_weight: number
        }
        Insert: {
          hangout_id: string
          invited_at?: string | null
          invited_by?: string | null
          notifications_muted?: boolean
          responded_at?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          status?: Database["public"]["Enums"]["participant_status"]
          user_id: string
          vote_weight?: number
        }
        Update: {
          hangout_id?: string
          invited_at?: string | null
          invited_by?: string | null
          notifications_muted?: boolean
          responded_at?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          status?: Database["public"]["Enums"]["participant_status"]
          user_id?: string
          vote_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "hangout_participants_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangout_participants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangout_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hangouts: {
        Row: {
          cancelled_at: string | null
          cover_photo_url: string | null
          created_at: string | null
          description: string | null
          end_time: string | null
          host_id: string
          id: string
          primary_location_address: string | null
          primary_location_geo: unknown
          primary_location_name: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["hangout_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          host_id: string
          id?: string
          primary_location_address?: string | null
          primary_location_geo?: unknown
          primary_location_name?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["hangout_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          host_id?: string
          id?: string
          primary_location_address?: string | null
          primary_location_geo?: unknown
          primary_location_name?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["hangout_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hangouts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_stops: {
        Row: {
          created_at: string | null
          end_time: string | null
          google_place_id: string | null
          hangout_id: string
          id: string
          location_address: string | null
          location_geo: unknown
          location_name: string | null
          notes: string | null
          order_index: number
          start_time: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          google_place_id?: string | null
          hangout_id: string
          id?: string
          location_address?: string | null
          location_geo?: unknown
          location_name?: string | null
          notes?: string | null
          order_index: number
          start_time?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          google_place_id?: string | null
          hangout_id?: string
          id?: string
          location_address?: string | null
          location_geo?: unknown
          location_name?: string | null
          notes?: string | null
          order_index?: number
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_stops_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
        ]
      }
      location_pings: {
        Row: {
          accuracy_m: number | null
          geo: unknown
          heading: number | null
          session_id: string
          speed_mps: number | null
          updated_at: string | null
        }
        Insert: {
          accuracy_m?: number | null
          geo: unknown
          heading?: number | null
          session_id: string
          speed_mps?: number | null
          updated_at?: string | null
        }
        Update: {
          accuracy_m?: number | null
          geo?: unknown
          heading?: number | null
          session_id?: string
          speed_mps?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_pings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "location_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      location_sessions: {
        Row: {
          ended_at: string | null
          expires_at: string
          hangout_id: string
          id: string
          started_at: string | null
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          expires_at: string
          hangout_id: string
          id?: string
          started_at?: string | null
          user_id: string
        }
        Update: {
          ended_at?: string | null
          expires_at?: string
          hangout_id?: string
          id?: string
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_sessions_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          hangout_id: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          hangout_id: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          hangout_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          bill_added: boolean
          bill_marked_paid: boolean
          friend_request_accepted: boolean
          friend_request_received: boolean
          hangout_invited: boolean
          hangout_reminder: boolean
          itinerary_published: boolean
          location_shared_with_you: boolean
          message_received: boolean
          poll_closed: boolean
          poll_created: boolean
          poll_deadline_soon: boolean
          poll_voting_opened: boolean
          post_comment: boolean
          post_created_by_friend: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bill_added?: boolean
          bill_marked_paid?: boolean
          friend_request_accepted?: boolean
          friend_request_received?: boolean
          hangout_invited?: boolean
          hangout_reminder?: boolean
          itinerary_published?: boolean
          location_shared_with_you?: boolean
          message_received?: boolean
          poll_closed?: boolean
          poll_created?: boolean
          poll_deadline_soon?: boolean
          poll_voting_opened?: boolean
          post_comment?: boolean
          post_created_by_friend?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bill_added?: boolean
          bill_marked_paid?: boolean
          friend_request_accepted?: boolean
          friend_request_received?: boolean
          hangout_invited?: boolean
          hangout_reminder?: boolean
          itinerary_published?: boolean
          location_shared_with_you?: boolean
          message_received?: boolean
          poll_closed?: boolean
          poll_created?: boolean
          poll_deadline_soon?: boolean
          poll_voting_opened?: boolean
          post_comment?: boolean
          post_created_by_friend?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          added_by: string
          created_at: string | null
          google_place_id: string | null
          id: string
          label: string
          metadata: Json | null
          poll_id: string
        }
        Insert: {
          added_by: string
          created_at?: string | null
          google_place_id?: string | null
          id?: string
          label: string
          metadata?: Json | null
          poll_id: string
        }
        Update: {
          added_by?: string
          created_at?: string | null
          google_place_id?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closed_at: string | null
          created_at: string | null
          created_by: string
          hangout_id: string
          id: string
          kind: Database["public"]["Enums"]["poll_kind"]
          mode: Database["public"]["Enums"]["poll_mode"]
          phase: Database["public"]["Enums"]["poll_phase"]
          suggest_deadline: string | null
          title: string
          vote_deadline: string
          winning_option_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          created_by: string
          hangout_id: string
          id?: string
          kind: Database["public"]["Enums"]["poll_kind"]
          mode: Database["public"]["Enums"]["poll_mode"]
          phase?: Database["public"]["Enums"]["poll_phase"]
          suggest_deadline?: string | null
          title: string
          vote_deadline: string
          winning_option_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          created_by?: string
          hangout_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["poll_kind"]
          mode?: Database["public"]["Enums"]["poll_mode"]
          phase?: Database["public"]["Enums"]["poll_phase"]
          suggest_deadline?: string | null
          title?: string
          vote_deadline?: string
          winning_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_winning_option_fk"
            columns: ["winning_option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          deleted_at: string | null
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_images: {
        Row: {
          created_at: string | null
          id: string
          order_index: number
          post_id: string
          storage_path: string
          thumbnail_path: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_index: number
          post_id: string
          storage_path: string
          thumbnail_path: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_index?: number
          post_id?: string
          storage_path?: string
          thumbnail_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string | null
          kind: Database["public"]["Enums"]["reaction_kind"]
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          kind: Database["public"]["Enums"]["reaction_kind"]
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          kind?: Database["public"]["Enums"]["reaction_kind"]
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_visibility_allowlist: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_visibility_allowlist_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_visibility_allowlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string | null
          deleted_at: string | null
          hangout_id: string | null
          id: string
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string | null
          deleted_at?: string | null
          hangout_id?: string | null
          id?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string | null
          deleted_at?: string | null
          hangout_id?: string | null
          id?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          default_calendar_visibility: string
          default_post_visibility: string
          deleted_at: string | null
          display_name: string
          id: string
          last_active_at: string | null
          profile_complete: boolean
          push_token: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          default_calendar_visibility?: string
          default_post_visibility?: string
          deleted_at?: string | null
          display_name: string
          id: string
          last_active_at?: string | null
          profile_complete?: boolean
          push_token?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          default_calendar_visibility?: string
          default_post_visibility?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          last_active_at?: string | null
          profile_complete?: boolean
          push_token?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_poll_responses: {
        Row: {
          created_at: string | null
          response: Database["public"]["Enums"]["slot_response"]
          slot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          response: Database["public"]["Enums"]["slot_response"]
          slot_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          response?: Database["public"]["Enums"]["slot_response"]
          slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_poll_responses_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "time_poll_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_poll_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_poll_slots: {
        Row: {
          ends_at: string
          id: string
          starts_at: string
          time_poll_id: string
        }
        Insert: {
          ends_at: string
          id?: string
          starts_at: string
          time_poll_id: string
        }
        Update: {
          ends_at?: string
          id?: string
          starts_at?: string
          time_poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_poll_slots_time_poll_id_fkey"
            columns: ["time_poll_id"]
            isOneToOne: false
            referencedRelation: "time_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      time_polls: {
        Row: {
          closed_at: string | null
          created_at: string | null
          created_by: string
          hangout_id: string | null
          id: string
          title: string
          vote_deadline: string
          winning_slot_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          created_by: string
          hangout_id?: string | null
          id?: string
          title: string
          vote_deadline: string
          winning_slot_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          created_by?: string
          hangout_id?: string | null
          id?: string
          title?: string
          vote_deadline?: string
          winning_slot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_polls_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "hangouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_polls_winning_slot_fk"
            columns: ["winning_slot_id"]
            isOneToOne: false
            referencedRelation: "time_poll_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string | null
          id: string
          option_id: string
          poll_id: string
          voter_id: string
          weight: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id: string
          poll_id: string
          voter_id: string
          weight: number
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: string
          poll_id?: string
          voter_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: {
        Args: { _user_a: string; _user_b: string }
        Returns: boolean
      }
      is_hangout_host: {
        Args: { _hangout_id: string; _user_id: string }
        Returns: boolean
      }
      is_hangout_participant: {
        Args: { _hangout_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      calendar_visibility: "friends" | "selected" | "private"
      hangout_status:
        | "planning"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      notification_kind:
        | "friend_request_received"
        | "friend_request_accepted"
        | "hangout_invited"
        | "poll_created"
        | "poll_deadline_soon"
        | "poll_voting_opened"
        | "poll_closed"
        | "itinerary_published"
        | "hangout_reminder"
        | "message_received"
        | "post_created_by_friend"
        | "post_comment"
        | "bill_added"
        | "bill_marked_paid"
        | "location_shared_with_you"
      participant_role: "host" | "co_host" | "guest"
      participant_status:
        | "invited"
        | "accepted"
        | "declined"
        | "maybe"
        | "removed"
      poll_kind: "activity" | "cuisine" | "restaurant"
      poll_mode: "simple_vote" | "suggest_then_vote"
      poll_phase: "suggesting" | "voting" | "closed"
      post_visibility: "friends" | "hangout_only" | "selected"
      reaction_kind: "like" | "love" | "laugh" | "wow"
      report_status: "pending" | "reviewed" | "dismissed" | "actioned"
      report_target_type: "user" | "post" | "comment" | "message"
      slot_response: "yes" | "no" | "maybe"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      calendar_visibility: ["friends", "selected", "private"],
      hangout_status: [
        "planning",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      notification_kind: [
        "friend_request_received",
        "friend_request_accepted",
        "hangout_invited",
        "poll_created",
        "poll_deadline_soon",
        "poll_voting_opened",
        "poll_closed",
        "itinerary_published",
        "hangout_reminder",
        "message_received",
        "post_created_by_friend",
        "post_comment",
        "bill_added",
        "bill_marked_paid",
        "location_shared_with_you",
      ],
      participant_role: ["host", "co_host", "guest"],
      participant_status: [
        "invited",
        "accepted",
        "declined",
        "maybe",
        "removed",
      ],
      poll_kind: ["activity", "cuisine", "restaurant"],
      poll_mode: ["simple_vote", "suggest_then_vote"],
      poll_phase: ["suggesting", "voting", "closed"],
      post_visibility: ["friends", "hangout_only", "selected"],
      reaction_kind: ["like", "love", "laugh", "wow"],
      report_status: ["pending", "reviewed", "dismissed", "actioned"],
      report_target_type: ["user", "post", "comment", "message"],
      slot_response: ["yes", "no", "maybe"],
    },
  },
} as const
