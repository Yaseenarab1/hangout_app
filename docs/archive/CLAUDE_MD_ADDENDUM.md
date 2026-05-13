# CLAUDE.md — addendum for Phase 3E

This block updates the project context with patterns introduced in
Phase 3E (receipt OCR + item-level bill splitting + standalone bills).

**Action for Claude Code:** merge these additions into the existing
`CLAUDE.md` in the project root. Don't replace the file — add a section.
If a rule below conflicts with something in the existing CLAUDE.md, the
addendum wins because it's newer.

---

## Phase 3E additions to "Stack"
- Google Cloud Vision API (already on the same Google Cloud project as
  Places). Used for receipt OCR via the Vision REST endpoint.
- Secret: `GOOGLE_CLOUD_VISION_API_KEY` (separate from
  `GOOGLE_PLACES_API_KEY` — create new). Set via:
  `npx supabase secrets set GOOGLE_CLOUD_VISION_API_KEY=...`
- Enable "Cloud Vision API" in Google Cloud Console for the project.

## Phase 3E additions to "Critical rules"

### Receipt OCR
- All Vision API calls go through a Supabase edge function
  (`scan-receipt`). Never call from the client — protects the API key.
- Vision mode: `TEXT_DETECTION` (NOT `DOCUMENT_TEXT_DETECTION`).
  TEXT_DETECTION returns position-tagged blocks better suited for
  receipt parsing.
- OCR results are always editable. After parse, the user reviews and
  fixes items before assigning. Treat OCR as a first draft, never as
  ground truth.
- If OCR fails (timeout, low confidence, no items detected) → fall back
  to manual entry flow with a friendly toast, not a hard error.
- Don't store the receipt image more than 30 days unless user keeps it
  as the bill receipt. Cleanup via scheduled function (future work).

### Item-level bills
- A `bill` can be in two modes: `whole` (legacy, like Phase 3D) or
  `itemized` (new in 3E).
- Itemized bills have a `bill_items` table. Each item is assigned to
  one or more participants via `bill_item_assignments`.
- Tax and tip get distributed PROPORTIONALLY to each person's item
  subtotal — never split equally. If Mike's items total $40 and Sarah's
  total $20, and tax was $6, Mike pays $4 tax, Sarah pays $2.
- Rounding: distribute remainder cents to the person with the largest
  subtotal first. No cents lost.

### Standalone bills (no hangout)
- Bills can exist without a hangout (`bills.hangout_id` now nullable).
- Standalone bills support GUEST participants (non-users) via the
  `bill_guest_participants` table. Guests have a name only — no auth,
  no notifications, no balance tracking across other bills.
- Standalone bills appear in the user's bill history (Profile → Bills).
  Not in any hangout's bill list.
- RLS for standalone bills: only the bill creator and any user
  participants can see them. Guests don't have accounts, so they can't
  see anything.

### FAB pattern (floating action button on Home)
- Floating action button bottom-right, above tab bar (z-index above
  scroll content).
- Brand violet, plus icon, 56×56, shadow.
- Tap opens a bottom action sheet (NOT a route push). Sheet has options:
  - "Split a bill" → opens standalone bill entry flow
  - Future: "Quick hangout" / "Start a poll"
- Sheet uses native `Modal` with `presentationStyle="pageSheet"` or
  `react-native-bottom-sheet` if already installed.

## Phase 3E additions to "Common bugs"
- OCR misses last line (totals/tax) when receipt is tall — handle by
  scrolling the photo or capturing in landscape. Document in UX.
- Tax/tip parsing: receipts use wildly different formats. Don't try to
  auto-detect — show separate fields and ask the user to confirm. Most
  receipts that have "TIP" line, but many don't include tip (it was on
  the card). Cash receipts often have NO tip line at all.
- Receipt photos in low light → low OCR accuracy. Show a tip: "Take
  the photo in good light, flat on a table."
- Currency: still USD only. If OCR detects a non-$ symbol, warn user
  but allow proceed (they can correct numbers).

## Phase 3E additions to "Communication style"
- Receipt scanning is a delightful feature — explain it briefly to users
  in-app. Small-print explainer on the scan screen: "Snap your receipt
  and we'll pull out each item. You can edit anything before splitting."
- Show progress states clearly: "Reading receipt…" / "Found 8 items" /
  "Couldn't read this one — try retaking or enter items manually."

## Phase 3 sub-phase order (updated)
- 3.0 — Foundation
- 3A — Group messaging
- 3B — Shared photo albums
- 3D — Bills + expense splitting (basic, complete or near-complete)
- **3E — Receipt OCR + item-level splitting + standalone bills (NEW)**
- 3C — Social feed
