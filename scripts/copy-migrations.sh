#!/usr/bin/env bash
# scripts/copy-migrations.sh
#
# Copies the canonical SQL files from `db/` into `supabase/migrations/` with
# timestamped names so the Supabase CLI applies them in order.
#
# Run this once before `supabase db push`. The Supabase CLI will then pick up
# the timestamped files. Re-running is safe — it overwrites.

set -euo pipefail

DEST="supabase/migrations"
mkdir -p "$DEST"

# Use a fixed initial timestamp so the migrations are deterministic in dev.
# In production, real new migrations should use the actual current time.
TS="20260101"

cp "db/001_schema.sql"           "$DEST/${TS}000000_schema.sql"
cp "db/002_rls_policies.sql"     "$DEST/${TS}000100_rls_policies.sql"
cp "db/003_triggers.sql"         "$DEST/${TS}000200_triggers.sql"
cp "db/004_storage_policies.sql" "$DEST/${TS}000300_storage_policies.sql"

echo "Migrations copied:"
ls -1 "$DEST"
