# Phase 2D — Place detail, photos, and polish

## Project state at start of this phase
Phases 0 through 2C-final are done and working in production-quality dev
state. The app supports:
- Auth (Apple + email/password), profiles, friends, blocking
- Hangouts: create / invite / RSVP / co-host roles / cancel / delete
- Activity polls with 4 paths (just pick / activity+venue / know what,
  find where / know everything)
- Food polls with 4 paths (just cuisine / cuisine+restaurant / restaurants
  only / know where to go)
- Simple AND ranked voting, vote weights (0× to 3×), per-user sort
- "Manage options" sheet with optimistic add/remove
- Restaurant search with rating/price/distance/cuisine filters
- Activity venue search with rating/price/distance filters
- Follow-up flows (cuisine wins → pick restaurant; activity wins → pick
  venue)
- Optimistic vote updates

Phase 2D adds the remaining functional polish + a key feature gap:
viewing place details with photos.

## Goals (in priority order)

### 2D.1 — Place detail sheet (HIGHEST PRIORITY)
When a user taps a poll option that's a Google Place (restaurant or
activity venue), open a bottom sheet showing:
- Hero photo carousel (swipe through 1-5 photos)
- Name, rating, price level, primary type
- Full address with "Open in Maps" link
- Phone (tap to call)
- Website link
- Hours of operation (today's hours prominent, "See all hours" expandable)
- Map preview (small static map showing location)

The sheet should also have a primary action button:
- If poll is in voting phase: "Vote for this" / "Remove vote"
  (matches the inline vote button behavior)
- If poll is closed: "Open in Maps"

### 2D.2 — Photo proxy Edge Function
Google Places photos require an API call with the API key. We proxy this
through Supabase to keep the key server-side.

Create new edge function: `supabase/functions/places-photo/index.ts`
- Input: `{ photoName: string, maxWidthPx?: number, maxHeightPx?: number }`
- Calls Google Places: `https://places.googleapis.com/v1/{photoName}/media`
- Returns the image bytes as the response (with proper content-type)
- Handles caching headers (immutable, 1 day)
- Uses the existing `GOOGLE_PLACES_API_KEY` secret

Then update `places-search` and `places-details` edge functions to also
return photo names (the `photos` field) so we know what to fetch.

### 2D.3 — Better place data in poll option metadata
Currently, restaurant poll options store: placeId, address, rating,
priceLevel, primaryType, mapsUrl. Add to that:
- phone
- website
- photos (array of photo names from Places API)
- hours (weekday descriptions)

Need to update:
- `places-search` edge function to return these fields
- `places-details` edge function (newly used for sheet open)
- `Place` type in `src/features/places/types.ts`
- Restaurant + activity venue picker → store these in metadata
- Place detail sheet → consume them

### 2D.4 — Custom location override (low priority, do after 2D.1-3)
User can change search center from NYC default. Lives in
Profile → Settings → "Search location". Saves to local storage AND user
profile. All Places searches use this if set, NYC otherwise.
- New screen: `app/profile/settings/search-location.tsx`
- Uses Google Places Autocomplete (already proxied) for location picker
- Stores `{ name, lat, lng }` in profile.metadata.search_location

### 2D.5 — Bottom-tab restructure (low priority, do last)
Currently: Home / Calendar / Messages / Profile (tabs).
Change to: Home / Hangouts / Friends / Profile.
- Calendar widget moves to top of Home screen (compact)
- Hangouts gets its own tab with the existing list
- Friends moves out of nested location into its own tab

### 2D.6 — Bottom sheet on Home "New" button
Currently "New" routes directly to /hangout/new (the manual create flow).
Replace with a bottom sheet offering:
- Find what to do → /hangout/new-activity
- Plan food → /hangout/new-food
- Plan a day (multi-stop) → /hangout/new-day [stub for now]
- Custom hangout → /hangout/new

## File-by-file plan for 2D.1 + 2D.2 + 2D.3 (do these together first)

### Backend
**`supabase/functions/places-photo/index.ts`** — NEW
- Deno edge function pattern (copy from `places-search` for boilerplate)
- Reads photo name from query string
- Proxies to Google Places photo media endpoint
- Returns image binary with cache headers
- Auth: same as other places functions (allow authenticated users)

**`supabase/functions/places-search/index.ts`** — MODIFY
- Add `photos`, `phone`, `website`, `hours` to the response field mask
- Update return type

**`supabase/functions/places-details/index.ts`** — MODIFY (or create if missing)
- Same field additions
- Used by the place detail sheet to fetch fresh data when opened

### Types
**`src/features/places/types.ts`** — UPDATE
```ts
export type Place = {
  // existing fields...
  phone?: string | null;
  website?: string | null;
  photos?: string[] | null;       // photo resource names
  hoursWeekday?: string[] | null; // ["Mon: 9-5", "Tue: 9-5", ...]
  isOpenNow?: boolean | null;
};
```

### New components
**`src/features/places/components/PlaceDetailSheet.tsx`** — NEW
- Modal sheet, presentationStyle="pageSheet"
- Loading state: shows skeleton hero + skeleton text rows while details load
- Error state: "Couldn't load details"
- Hero: horizontal FlatList of photos (use `<PlacePhoto>` below)
- Below: structured rows for rating/price, address, phone, website, hours
- Bottom action button (vote/unvote OR open in maps)
- Props: `{ visible, onClose, placeId, hangoutId?, pollOptionId?, voteState? }`
  - If `pollOptionId` provided, shows vote button
  - If not, shows "Open in Maps"

**`src/features/places/components/PlacePhoto.tsx`** — NEW
- `<Image>` wrapper that loads from the photo proxy
- Props: `{ photoName, width, height, style? }`
- URL: `https://cruosjnuhcuewjnzhlja.supabase.co/functions/v1/places-photo?photoName=...&maxWidthPx=...`
- Includes auth header (anon key) since edge functions require auth
- Loading skeleton while loading, fallback box on error

### Hooks / services
**`src/features/places/services/places.service.ts`** — UPDATE
- Add `fetchPlaceDetails(placeId)` — calls `places-details` edge function
- Returns full `Place` with photos/hours/etc

**`src/features/places/hooks/usePlaces.ts`** — UPDATE (or create)
- `usePlaceDetails(placeId)` query, staleTime 10min

**`src/features/places/index.ts`** — UPDATE
- Export `PlaceDetailSheet`, `PlacePhoto`, `usePlaceDetails`,
  `fetchPlaceDetails`

### Wire-up in existing components
**`src/features/polls/components/PollCard.tsx`** — MODIFY
- For options with `metadata.placeId`, wrap the option row to make it
  long-press → open `<PlaceDetailSheet>`. Don't replace the tap-to-vote
  behavior — long-press for details, tap to vote.

**`src/features/food/components/RestaurantSearchPicker.tsx`** — MODIFY
- Add a small "i" icon on each result row that opens `<PlaceDetailSheet>`
  in browse mode (no vote action, just "Open in Maps")
- Helps users research places before adding to selection

**`src/features/polls/components/ActivityVenuePicker.tsx`** — MODIFY
- Same "i" icon pattern

## Acceptance criteria
- [ ] Long-press a poll option that's a Google Place → sheet opens with
      photo carousel + details
- [ ] Photos load (not broken images, not stuck on skeleton forever)
- [ ] Error state shows when network fails
- [ ] "Open in Maps" works on iOS (deep links to Apple Maps)
- [ ] Phone tap opens dialer
- [ ] Website tap opens browser
- [ ] Hours show today's hours prominently
- [ ] Vote button in sheet works the same as inline (optimistic update)
- [ ] Sheet closes on Vote action
- [ ] No additional Google API calls beyond the photo proxy on first open
      (use details query cache)
- [ ] Long-press also works in restaurant search picker (browse mode,
      no vote button — just "Open in Maps")

## Edge cases to handle
- Place has 0 photos → show a styled placeholder, not broken image icon
- Place has no rating → hide rating row, don't show "0.0"
- Place has no phone → hide phone row
- Place has no hours → show "Hours not available"
- Place is permanently closed → show "Permanently closed" prominently
- User long-presses a custom (non-Google) option → sheet says "Custom
  place — no details available", just shows the name + address
- Network slow → show skeleton, not blank
- User opens sheet, server returns 403 (API key issue) → show
  "Couldn't load. Check your connection." Don't expose API errors
- User taps "Vote" in sheet, then closes → vote should still apply
  (optimistic update commits)
- User has 0× weight and taps "Vote for this" → either disable button
  or show toast "Your vote weight is 0× — you can vote but it won't count"

## After 2D.1-3 work end-to-end, do 2D.4-6 in any order

## What's NOT in 2D
These are explicitly Phase 3 or later:
- Real-time location sharing during hangouts
- Friend map view (map showing places + friends)
- Bills / expense splitting (whole new feature)
- Home feed (social posts)
- AI recommendations
- "Plan a Day" multi-stop itinerary builder
- "Find a Time" availability voting
- Real-time chat per hangout
- Photos per hangout (user-uploaded memories)
- Auto-progression of hangout status
- Suggest-then-vote mode UI (currently a placeholder)
- Auto poll closing on deadline
- Real-time vote updates (currently 5s polling)
- Push notifications

## How to start
1. Read this file end-to-end
2. Read `CLAUDE.md` end-to-end
3. Confirm you understand the current state by reading these files:
   - `src/features/polls/components/PollCard.tsx`
   - `src/features/polls/components/ActivityVenuePicker.tsx`
   - `src/features/food/components/RestaurantSearchPicker.tsx`
   - `src/features/places/services/places.service.ts`
   - `src/features/places/types.ts`
   - One of the existing edge functions: `supabase/functions/places-search/index.ts`
4. Tell me: "Read state. Plan ready. Want me to start with 2D.2 (photo
   proxy edge function) or 2D.1 (place detail sheet)?"
   - Recommendation: start with 2D.2 (backend) so photos work end-to-end
     by the time the sheet UI lands.
5. After each file written, run:
   ```bash
   npx tsc --noEmit
   ```
   Fix errors before moving on.
6. After 2D.2 is deployed: `npx supabase functions deploy places-photo`
7. After 2D.1 + 2D.2 + 2D.3 all work end-to-end:
   ```bash
   git add . && git commit -m "Phase 2D.1-3: place detail sheet + photos"
   ```

## Notes for Claude Code
- The user is a first-time mobile dev. Explain decisions briefly when
  there's a tradeoff. Don't lecture.
- Casual tone is fine. The user types fast, expects same back.
- If you hit something genuinely ambiguous, ASK before guessing. The user
  prefers a 30-second clarifying question over a wrong implementation.
- Test by running iOS simulator (`npx expo start --ios` or `i` in dev menu).
- The user has hit too many "edge case" bugs already — enumerate edge
  cases before writing each component.
