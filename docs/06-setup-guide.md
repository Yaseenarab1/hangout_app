# Hangout Planner — Setup Guide

**Version:** 1.0 (Phase 0)

This guide walks you from a clean Mac to a working dev environment with the app running on your iPhone. Read it once, follow each step. Total time: ~90 minutes.

If you've never set up an Expo project before, do every step in order. If you're experienced, you can skim — but **do not skip §3 (secrets) or §6 (Supabase setup)**, those are project-specific.

---

## 1. Prerequisites (Mac)

Install in order:

### 1.1 Xcode

- Install **Xcode** from the App Store (latest stable). This is a ~7 GB download — start it first and let it run.
- Once installed, open it once and accept the license.
- Install Command Line Tools:
  ```bash
  xcode-select --install
  ```
- Open Xcode → Settings → Platforms → install the latest iOS Simulator.

### 1.2 Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1.3 Node, pnpm, Watchman, Git

```bash
brew install node@20 pnpm watchman git
```

We use `pnpm` (not `npm`) for faster installs and stricter dependency resolution. We use Node 20 LTS.

### 1.4 Expo CLI and EAS CLI

```bash
pnpm add -g expo-cli eas-cli
```

### 1.5 Supabase CLI

```bash
brew install supabase/tap/supabase
```

### 1.6 Docker (for local Supabase)

Install **Docker Desktop** from https://www.docker.com/products/docker-desktop. Open it once so it starts the Docker engine.

### 1.7 Verify

```bash
node -v        # v20.x
pnpm -v        # 9.x or 10.x
expo --version
eas --version
supabase --version
docker --version
```

If any of these fail, fix before continuing.

---

## 2. Apple Developer account

- Go to https://developer.apple.com and sign up. You can develop on the simulator without paying, but pushing to a real device or shipping to TestFlight requires the paid program ($99/year).
- **Enroll as an Individual.** You can transfer the app to a company entity later. Enrolling as a company now requires a D-U-N-S number and adds friction.
- Once enrolled (can take 24–48 hours), you'll have an Apple Developer ID.

For Phase 1 you can run on the iOS Simulator without paying. Pay before Phase 5 (TestFlight beta).

---

## 3. Accounts you need (free tier is enough for now)

Create these now so you have credentials ready:

| Service | Purpose | Free tier sufficient until |
|---------|---------|---------------------------|
| **Supabase** | Backend | ~10k MAU |
| **Expo (EAS)** | Cloud builds + push | 30 builds/mo + unlimited push |
| **Sentry** | Error tracking | 5k errors/mo |
| **PostHog** | Analytics | 1M events/mo |
| **Google Cloud** | Places, Maps, Vision | $200/mo credit |
| **GitHub** | Source control | Free for private repos |

Sign up for all of them. **Do not buy domains or LLCs yet** — premature.

### Google Cloud APIs to enable

In your Google Cloud project:
1. Enable **Places API (New)**
2. Enable **Maps SDK for iOS**
3. Enable **Directions API**
4. Enable **Cloud Vision API**
5. Create an **API key** with restrictions: only the four APIs above. We will further restrict in Phase 5.

---

## 4. Clone and install

```bash
git clone <your-github-repo>.git hangout-planner
cd hangout-planner
pnpm install
```

(For Phase 0 you don't have a repo yet. Create one on GitHub now — call it `hangout-planner`, private. We'll fill it in Phase 1.)

---

## 5. Environment variables

We use a layered approach:
- `.env.local` — your machine, never committed (in `.gitignore`)
- `EAS Secrets` — for builds, never committed
- `Supabase Vault` — for Edge Function secrets

Create `.env.local` in the project root:

```bash
# Public — safe in client bundle
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
EXPO_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
EXPO_PUBLIC_POSTHOG_KEY=<your-posthog-key>
EXPO_PUBLIC_POSTHOG_HOST=https://us.posthog.com

# Server-only — used by Edge Functions, set via supabase secrets
# DO NOT put these in EXPO_PUBLIC_*
# (set them later: see §6.4)
```

**Rule:** anything prefixed `EXPO_PUBLIC_` is bundled into the app and visible to anyone who downloads it. That's fine for the Supabase anon key (RLS protects the data) but never put a service-role or third-party API key with `EXPO_PUBLIC_`.

---

## 6. Supabase setup

### 6.1 Create a project

- Go to https://supabase.com → New Project.
- Name: `hangout-planner-dev` (we'll create a separate `-prod` later).
- Region: pick closest to you (US East if East Coast US).
- Strong DB password — save it in a password manager.
- Wait ~2 minutes.

### 6.2 Get credentials

- Project Settings → API → copy:
  - Project URL → `EXPO_PUBLIC_SUPABASE_URL`
  - `anon` `public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` key → save securely (NOT in `.env.local`); used only in Edge Functions

### 6.3 Run migrations

From your local checkout:

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Apply schema and policies (these are the SQL files from Phase 0)
supabase db push
```

The migration files (`db/001_schema.sql`, `db/002_rls_policies.sql`, `db/003_triggers.sql`) will be moved to `supabase/migrations/` with timestamped names in Phase 1.

### 6.4 Set Edge Function secrets

Once we have Edge Functions in Phase 2, you'll set their secrets like this:

```bash
supabase secrets set GOOGLE_PLACES_API_KEY=<key>
supabase secrets set GOOGLE_VISION_API_KEY=<key>
supabase secrets set EXPO_PUSH_ACCESS_TOKEN=<key>
```

These are stored encrypted at rest in Supabase Vault.

### 6.5 Storage buckets

In Supabase dashboard → Storage, create:
- `avatars` — Public bucket
- `post-images` — Private bucket
- `album-photos` — Private bucket
- `receipts` — Private bucket

We'll add storage RLS policies in Phase 1.

### 6.6 Local dev (optional but recommended)

For offline development you can run Supabase locally:

```bash
supabase start
```

This spins up Postgres, Auth, Storage, and Functions on your machine via Docker. It mirrors production. Use the local URL/keys in `.env.local` when developing offline.

---

## 7. iOS Simulator first run

Once we have Phase 1 code in place:

```bash
pnpm start              # starts Expo dev server
# press 'i' to open iOS simulator
```

First launch takes 2–3 minutes (Metro bundler builds the JS bundle).

To run on your physical iPhone:
1. Install the **Expo Go** app from the App Store.
2. With Expo dev server running, scan the QR code with the Camera app.
3. Tap the link to open in Expo Go.

(Once we have native modules that don't work in Expo Go — e.g., Apple Sign-In, location background — we'll switch to a "development build." That's a ~10-minute one-time setup we'll do at the start of Phase 1.)

---

## 8. Useful scripts

These will be defined in `package.json` in Phase 1:

```bash
pnpm start              # Expo dev server
pnpm ios                # opens iOS simulator
pnpm typecheck          # tsc --noEmit
pnpm lint               # ESLint + Prettier
pnpm test               # Jest
pnpm db:types           # regenerate types from Supabase schema
pnpm db:migrate         # supabase db push
pnpm build:dev          # EAS internal build
pnpm build:preview      # EAS TestFlight build
pnpm build:prod         # EAS App Store build
```

---

## 9. Editor setup

**VS Code** is recommended. Install these extensions:

- ESLint
- Prettier
- TypeScript Vue/React (the JS one)
- Tailwind CSS IntelliSense (we'll use NativeWind in Phase 1)
- Expo Tools
- Supabase

Workspace settings (`.vscode/settings.json`) will be checked into the repo in Phase 1.

---

## 10. Common gotchas (first-time mobile dev)

- **"Metro bundler hangs on first run."** First bundle takes minutes. Wait it out. If it hangs >5 min, kill and restart.
- **"Pod install errors."** Run `cd ios && pod install` from project root. Requires Xcode CLI tools.
- **"Apple Sign-In doesn't work in Expo Go."** Correct — needs a development build. We do this at the start of Phase 1.
- **"My iPhone doesn't show up in Expo Go."** Same Wi-Fi network. Disable VPNs.
- **"Simulator is slow."** Use a smaller device (iPhone 14, not iPhone 15 Pro Max). Close other simulators.
- **"Push notifications don't fire on simulator."** Simulator does not receive real APNs. Use a real device.
- **"Changes don't appear."** In Metro bundler, press `r` to reload, or shake the device for the dev menu.
- **"Can't connect to Supabase from Simulator."** Check `EXPO_PUBLIC_SUPABASE_URL` is set and the dev server has been restarted (env vars only load on start).

---

## 11. What to do next

Once everything in this guide works, you're ready for Phase 1.

Reply "ready for Phase 1" and I'll deliver:
- Full `package.json` with locked dependencies
- Project skeleton (Expo Router, navigation, tab bar)
- Design system implementation (tokens, theme provider, dark mode)
- Auth flow (welcome, sign in, sign up, verify, create profile)
- Friends feature (list, search, requests, block)
- Profile feature (view, edit, settings)
- All wired up to the Supabase schema with proper TypeScript types
- Tests for business logic
- Working iOS app

Total Phase 1 delivery is approximately 60–80 files.
