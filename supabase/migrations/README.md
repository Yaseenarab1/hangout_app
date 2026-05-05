-- This file is the SAME content as db/001_schema.sql, with a timestamped name
-- so the Supabase CLI applies it.
--
-- Convention: <YYYYMMDDHHMMSS>_<description>.sql
-- Migrations are applied in filename order. New migrations get a fresh timestamp.
--
-- For Phase 1 we use these initial timestamps:
--   20260101000000_schema.sql
--   20260101000100_rls_policies.sql
--   20260101000200_triggers.sql
--   20260101000300_storage_policies.sql

-- The actual schema lives in db/001_schema.sql. Run the helper script
-- `scripts/copy-migrations.sh` to copy them in, OR symlink / re-export here.
-- This file is a placeholder that imports — see scripts/copy-migrations.sh.

-- Placeholder content for the migration. In practice, you'll either:
--   (a) copy db/001_schema.sql contents here verbatim, OR
--   (b) run `cp db/*.sql supabase/migrations/` with timestamped names.
-- Both work. We do (b) via the script below.

select 'See scripts/copy-migrations.sh' as note;
