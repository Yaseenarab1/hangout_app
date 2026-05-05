# Hangout Planner — Design System

**Version:** 1.0 (Phase 0)

This document defines the visual and interaction language of the app. It is the source of truth for colors, typography, spacing, motion, and component behavior. Designers and developers refer here before making decisions.

---

## 1. Brand identity (working)

**Personality:** Warm, social, modern, confident. Friendly enough that a 19-year-old wants to use it with their friends, but not so playful it feels childish.

**Visual references** (mood, not copying): Partiful's editorial confidence, Linear's restraint, BeReal's friend-first warmth, Cash App's directness.

**Logo direction:** A geometric "H" mark or a "pin" mark (alluding to meeting up). We will not finalize the logo in Phase 0 — placeholder is a rounded square with a stylized "H." Design the real mark before App Store submission.

## 2. Color system

We use **HSL** in code (easier to derive shades) but document hex too. Colors are referenced by **semantic name**, never by raw hex, in the codebase.

### Brand color (the one color)

`brand-500` is a confident violet. We chose violet because:
- It's distinctive in the social/utility app space (most competitors use blue or green).
- It works well against both warm and cool photography in the social feed.
- It's accessible at AA contrast against both light and dark backgrounds.

```
brand-50:  #F5F3FF   (hsl 250 100% 97%)
brand-100: #EDE9FE   (hsl 251 91% 95%)
brand-200: #DDD6FE   (hsl 251 95% 92%)
brand-300: #C4B5FD   (hsl 252 95% 85%)
brand-400: #A78BFA   (hsl 255 92% 76%)
brand-500: #8B5CF6   (hsl 258 90% 66%)   ← primary
brand-600: #7C3AED   (hsl 263 83% 58%)   ← hover/pressed
brand-700: #6D28D9   (hsl 263 70% 50%)
brand-800: #5B21B6   (hsl 263 69% 42%)
brand-900: #4C1D95   (hsl 264 69% 35%)
```

### Neutrals

Two neutral scales — **slate** for light mode (warmer than pure gray), **zinc** for dark mode.

### Semantic tokens (light theme)

| Token | Value | Use |
|-------|-------|-----|
| `bg.canvas` | `#FAFAF9` | App background |
| `bg.surface` | `#FFFFFF` | Cards, sheets |
| `bg.subtle` | `#F4F4F5` | Inset surfaces, input bg |
| `bg.muted` | `#E4E4E7` | Disabled states, dividers |
| `border.default` | `#E4E4E7` | Card borders, input borders |
| `border.strong` | `#A1A1AA` | Focused inputs |
| `text.primary` | `#18181B` | Body, headings |
| `text.secondary` | `#52525B` | Subtitles, metadata |
| `text.tertiary` | `#71717A` | Hints, placeholders |
| `text.inverse` | `#FAFAFA` | Text on brand bg |
| `accent` | `brand-500` | Primary actions |
| `accent.hover` | `brand-600` | Pressed states |
| `accent.subtle` | `brand-50` | Brand-tinted backgrounds |
| `success` | `#16A34A` | Confirmations |
| `warning` | `#D97706` | Caution |
| `danger` | `#DC2626` | Destructive actions |
| `info` | `#0284C7` | Informational |

### Semantic tokens (dark theme)

| Token | Value | Use |
|-------|-------|-----|
| `bg.canvas` | `#09090B` | App background (near-black, not pure) |
| `bg.surface` | `#18181B` | Cards, sheets |
| `bg.subtle` | `#27272A` | Inset surfaces |
| `bg.muted` | `#3F3F46` | Disabled, dividers |
| `border.default` | `#27272A` | Borders |
| `border.strong` | `#52525B` | Focused inputs |
| `text.primary` | `#FAFAFA` | Body, headings |
| `text.secondary` | `#A1A1AA` | Subtitles |
| `text.tertiary` | `#71717A` | Hints |
| `text.inverse` | `#18181B` | Text on bright brand bg |
| `accent` | `brand-400` | Slightly lighter brand for dark contrast |
| `accent.hover` | `brand-300` | |
| `accent.subtle` | `#2A1F4D` | Brand-tinted backgrounds |
| `success` | `#22C55E` | |
| `warning` | `#F59E0B` | |
| `danger` | `#EF4444` | |
| `info` | `#38BDF8` | |

### Contrast requirements

Every text/background pairing must meet **WCAG AA** (4.5:1 for body, 3:1 for large text). We test this in CI via a lint rule that imports the token file and checks pairings.

## 3. Typography

**Font families:**
- iOS: **SF Pro** (system, free, no licensing concerns).
- Android (later): **Inter** loaded via `expo-font`.

We do not use a custom display font in v1. It's tempting (e.g., a "fun" header font) but adds bundle size, slows load, and creates accessibility issues. Defer to v2.

### Type scale

| Token | Size / Line-height | Weight | Use |
|-------|---|---|-----|
| `display` | 32 / 38 | 700 | Hero numbers, splash |
| `h1` | 28 / 34 | 700 | Screen titles |
| `h2` | 22 / 28 | 600 | Section headers |
| `h3` | 18 / 24 | 600 | Card titles |
| `body` | 16 / 22 | 400 | Body text |
| `bodyMedium` | 16 / 22 | 500 | Emphasized body |
| `bodySmall` | 14 / 20 | 400 | Secondary text |
| `caption` | 13 / 18 | 400 | Metadata, labels |
| `tiny` | 11 / 14 | 500 | Badges, timestamps |

**Never** use values not on this scale.

## 4. Spacing

4-point grid:

```
0:  0px
1:  4px
2:  8px
3:  12px
4:  16px    ← default screen padding
5:  20px
6:  24px
8:  32px
10: 40px
12: 48px
16: 64px
20: 80px
```

## 5. Radii

```
sm: 6px       buttons-small, badges
md: 10px      buttons, inputs, small cards
lg: 14px      cards
xl: 20px      sheets, modals
full: 9999px  pills, avatars
```

## 6. Elevation (shadows)

iOS-style soft shadows. We use 4 levels and never invent more.

```
e0: none
e1: 0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02)
e2: 0 4px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
e3: 0 10px 20px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)
e4: 0 20px 40px rgba(0,0,0,0.10)   modal/sheet backdrops
```

In dark mode, shadows are barely visible — we substitute a 1px `border.default` outline for separation.

## 7. Motion

**Principles:**
- Movements are short (150–250ms).
- Easings are `ease-out` for entries, `ease-in` for exits.
- Never animate to communicate; animate to feel responsive.
- Respect `prefers-reduced-motion` (iOS Reduce Motion setting).

**Standard durations:**
- `fast`: 150ms — taps, toggles
- `base`: 220ms — modals, sheets
- `slow`: 350ms — large transitions

## 8. Iconography

**Library:** `lucide-react-native` (consistent stroke, large set, MIT license).
**Stroke width:** 1.5px default, 2px on small sizes.
**Sizes:** 16, 20, 24, 32. Never use other sizes.

## 9. Components (the primitive set)

These are the components we build in Phase 1 and reuse everywhere. Each lives in `src/components/ui/` with its own file + tests + Storybook story (Phase 5).

| Component | Variants | Notes |
|-----------|----------|-------|
| `Button` | primary, secondary, ghost, danger; sm/md/lg | Always `min-height: 44px` (Apple HIG) |
| `Input` | text, password, email, search | Built-in error state, loading state |
| `Textarea` | — | Auto-grows up to 8 lines |
| `Select` | — | Native iOS picker via Action Sheet |
| `Checkbox` | — | |
| `Radio` | — | |
| `Switch` | — | Use for boolean toggles in settings |
| `Card` | default, interactive, danger | |
| `Avatar` | xs (24), sm (32), md (40), lg (56), xl (80); with online dot | Falls back to colored circle with initial |
| `Badge` | default, success, warning, danger, brand | |
| `Chip` | filter, removable, selectable | For cuisine picker, filter bars |
| `Tag` | — | Static labels |
| `Sheet` | — | Bottom sheet with snap points |
| `Modal` | — | Full-screen on small phones |
| `Toast` | success, error, info | Sonner-style stack, swipe to dismiss |
| `EmptyState` | — | Illustration + title + body + CTA |
| `Skeleton` | — | Replaces content during loading |
| `ListItem` | default, with-avatar, with-trailing | Single source for consistent rows |
| `SectionHeader` | — | "Friends (12)" |
| `TabBar` | — | Bottom navigation |
| `Header` | — | Top nav with back, title, actions |
| `SegmentedControl` | — | iOS-style segmented |
| `Spinner` | xs/sm/md | |
| `ErrorBoundary` | — | Wraps each screen |

## 10. Layout patterns

**Screen template** — every screen uses this:
```
<SafeView>
  <Header />
  <ScrollView contentContainerStyle={{padding: spacing[4], paddingBottom: spacing[10]}}>
    {content}
  </ScrollView>
</SafeView>
```

**Form template:**
- One field per row on small screens.
- Labels above inputs, never floating.
- Errors below inputs in `danger` color, with icon.
- Submit button is full-width, fixed at bottom on long forms.

## 11. Accessibility

- All interactive elements ≥ 44×44 hit area.
- All images have `accessibilityLabel`.
- Color is never the only signal (we pair with icon or text).
- Dynamic Type supported up to xxxLarge.
- Test with VoiceOver before each phase ships.
- Form errors announced via `accessibilityLiveRegion`.

## 12. Token implementation in code

```ts
// src/design/tokens.ts (excerpt — full file shipped in Phase 1)
export const colors = {
  light: {
    bg: { canvas: '#FAFAF9', surface: '#FFFFFF', subtle: '#F4F4F5', muted: '#E4E4E7' },
    border: { default: '#E4E4E7', strong: '#A1A1AA' },
    text: { primary: '#18181B', secondary: '#52525B', tertiary: '#71717A', inverse: '#FAFAFA' },
    accent: '#8B5CF6',
    accentHover: '#7C3AED',
    accentSubtle: '#F5F3FF',
    success: '#16A34A', warning: '#D97706', danger: '#DC2626', info: '#0284C7',
  },
  dark: { /* ... */ },
} as const;

export const spacing = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80,
} as const;

export const radii = { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 } as const;
```

Components consume these via the `useTheme()` hook so light/dark switching is automatic.

## 13. What we do not do

- **No gradients except the splash screen.** Flat colors age better.
- **No animated illustrations on every screen.** Reserve them for empty states and onboarding.
- **No emoji as UI.** Use real icons. Emoji in user content is fine.
- **No skeuomorphic textures, glassmorphism, or 3D effects.** They look dated within 18 months.
- **No more than 2 fonts.** One body, optionally one for numbers (we do not need this in v1).
- **No more than 3 type weights per screen.**
