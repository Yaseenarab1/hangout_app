-- Day plans: a full-day itinerary attached to a hangout
create table if not exists public.day_plans (
  id          uuid        primary key default gen_random_uuid(),
  hangout_id  uuid        not null references public.hangouts(id) on delete cascade,
  title       text        not null default 'Day Plan',
  plan_date   date,
  created_by  uuid        not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Day plan stops (ordered items)
create table if not exists public.day_plan_items (
  id               uuid        primary key default gen_random_uuid(),
  plan_id          uuid        not null references public.day_plans(id) on delete cascade,
  position         integer     not null default 0,
  item_type        text        not null check (item_type in ('restaurant', 'activity', 'custom')),
  title            text        not null,
  subtitle         text,
  start_time       text,        -- HH:MM 24h, optional
  duration_minutes integer,
  place_id         text,        -- Google Place ID
  place_data       jsonb,       -- {name, address, rating, priceLevel, photoReference, mapsUrl}
  notes            text,
  created_by       uuid        references public.profiles(id),
  created_at       timestamptz not null default now()
);

create index if not exists day_plan_items_plan_idx on public.day_plan_items(plan_id, position);

-- RLS
alter table public.day_plans enable row level security;
alter table public.day_plan_items enable row level security;
grant all on public.day_plans to authenticated;
grant all on public.day_plan_items to authenticated;

-- day_plans policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='day_plans' and policyname='day_plans_select') then
    create policy "day_plans_select" on public.day_plans for select
      using (is_hangout_participant(hangout_id, auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='day_plans' and policyname='day_plans_insert') then
    create policy "day_plans_insert" on public.day_plans for insert
      with check (auth.uid() = created_by and is_hangout_participant(hangout_id, auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='day_plans' and policyname='day_plans_update') then
    create policy "day_plans_update" on public.day_plans for update
      using (is_hangout_participant(hangout_id, auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='day_plans' and policyname='day_plans_delete') then
    create policy "day_plans_delete" on public.day_plans for delete
      using (auth.uid() = created_by);
  end if;
end $$;

-- day_plan_items policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='day_plan_items' and policyname='day_plan_items_select') then
    create policy "day_plan_items_select" on public.day_plan_items for select
      using (exists (select 1 from public.day_plans dp where dp.id = plan_id and is_hangout_participant(dp.hangout_id, auth.uid())));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='day_plan_items' and policyname='day_plan_items_insert') then
    create policy "day_plan_items_insert" on public.day_plan_items for insert
      with check (
        auth.uid() = created_by
        and exists (select 1 from public.day_plans dp where dp.id = plan_id and is_hangout_participant(dp.hangout_id, auth.uid()))
      );
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='day_plan_items' and policyname='day_plan_items_update') then
    create policy "day_plan_items_update" on public.day_plan_items for update
      using (exists (select 1 from public.day_plans dp where dp.id = plan_id and is_hangout_participant(dp.hangout_id, auth.uid())));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='day_plan_items' and policyname='day_plan_items_delete') then
    create policy "day_plan_items_delete" on public.day_plan_items for delete
      using (exists (select 1 from public.day_plans dp where dp.id = plan_id and is_hangout_participant(dp.hangout_id, auth.uid())));
  end if;
end $$;
