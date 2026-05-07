/**
 * Table name constants. Use these instead of inline strings.
 *
 * `supabase.from(TABLES.profiles).select('*')`
 * — TypeScript autocompletes the table name; rename safely with refactor tools.
 */
export const TABLES = {
  profiles: 'profiles',
  friendships: 'friendships',
  friend_requests: 'friend_requests',
  hangouts: 'hangouts',
  hangout_participants: 'hangout_participants',
  polls: 'polls',
  poll_options: 'poll_options',
  votes: 'votes',
  itinerary_stops: 'itinerary_stops',
  messages: 'messages',
  message_reads: 'message_reads',
  posts: 'posts',
  post_images: 'post_images',
  post_visibility_allowlist: 'post_visibility_allowlist',
  post_reactions: 'post_reactions',
  post_comments: 'post_comments',
  albums: 'albums',
  album_photos: 'album_photos',
  bills: 'bills',
  bill_splits: 'bill_splits',
  availability_blocks: 'availability_blocks',
  calendar_visibility_allowlist: 'calendar_visibility_allowlist',
  time_polls: 'time_polls',
  time_poll_slots: 'time_poll_slots',
  time_poll_responses: 'time_poll_responses',
  location_sessions: 'location_sessions',
  location_pings: 'location_pings',
  notifications: 'notifications',
  notification_preferences: 'notification_preferences',
  reports: 'reports',
  blocks: 'blocks',
} as const;

export const STORAGE_BUCKETS = {
  avatars: 'avatars',
  postImages: 'post-images',
  albumPhotos: 'album-photos',
  receipts: 'receipts',
  hangoutPhotos: 'hangout-photos',
} as const;

export const QUERY_KEYS = {
  profile: (id: string) => ['profile', id] as const,
  myProfile: ['profile', 'me'] as const,
  usernameAvailable: (username: string) => ['username-available', username] as const,
  friends: ['friends'] as const,
  friendRequests: (direction: 'incoming' | 'outgoing') =>
    ['friend-requests', direction] as const,
  friendSearch: (query: string) => ['friend-search', query] as const,
  blockedUsers: ['blocked-users'] as const,
  notificationPreferences: ['notification-preferences'] as const,
} as const;
