# Hangout Planner

A friend-group hangout planning app. iOS-first, React Native + Expo + Supabase.

> **Status:** Phase 1 — auth, profile, and friends. See `docs/01-PRD.md` for the full plan.

## Quick start

```bash
# 1. Prereqs (one time): see docs/06-setup-guide.md
# 2. Clone + install
pnpm install

# 3. Environment
cp .env.example .env.local
# fill in your Supabase URL + anon key, etc.

# 4. Database
supabase login
supabase link --project-ref <your-project-ref>
supabase db push

# 5. Generate types from your DB
pnpm db:types

# 6. Run
pnpm start
# press `i` to open iOS simulator
```

## Structure

```
app/                  Expo Router file-based routes
src/
├── components/       Shared UI (ui/, layout/, feedback/)
├── design/           Tokens + theme
├── features/         Feature folders (auth, profile, friends, ...)
├── hooks/            Shared hooks
├── lib/              Pure business logic (no I/O)
├── services/         External clients (supabase, sentry, posthog, ...)
├── stores/           Zustand stores
└── types/            App-wide types
config/               Single source of truth for app identity
db/                   Phase-0 SQL (becomes supabase/migrations/ when applied)
docs/                 All Phase-0 docs
supabase/             Migrations, edge functions, tests
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm start` | Expo dev server |
| `pnpm ios` | Run on iOS simulator (development build) |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm test` | Jest |
| `pnpm db:push` | Apply migrations to Supabase |
| `pnpm db:types` | Regenerate types from schema |
| `pnpm build:dev` | EAS development build |
| `pnpm build:preview` | EAS internal TestFlight build |
| `pnpm build:prod` | EAS App Store build |

## Documentation

Read these in order if you're new:

1. `docs/01-PRD.md` — what we're building
2. `docs/02-architecture.md` — how it's structured
3. `docs/03-design-system.md` — visual language
4. `docs/05-security-and-privacy.md` — security model
5. `docs/06-setup-guide.md` — environment setup
6. `docs/09-phase-1-checklist.md` — current phase definition-of-done

Database schema: `db/001_schema.sql` + `db/002_rls_policies.sql` + `db/003_triggers.sql`.

## Key principles (the short version)

- **The database enforces permissions, not the app.** RLS policies in Postgres are the source of truth. The client trusts nothing. (See `docs/05-security-and-privacy.md`.)
- **Pure business logic in `src/lib/`.** No I/O, fully unit-tested.
- **Feature folders.** Code for friends lives in `src/features/friends/`, not scattered.
- **No magic strings.** Table names, query keys, event names are exported constants.
- **Server is the source of truth.** The client uses optimistic updates and reconciles.

## License

Proprietary — all rights reserved.
