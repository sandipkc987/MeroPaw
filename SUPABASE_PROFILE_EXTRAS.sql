-- Pet profile extras (personality / wellness / achievements)
-- Run this separately from SUPABASE_APP_SCHEMA.sql

create table if not exists pet_profile_extras (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  personality jsonb,
  wellness jsonb,
  achievements jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (owner_id, pet_id)
);

alter table pet_profile_extras enable row level security;

create policy "Users manage their pet profile extras"
on pet_profile_extras for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

