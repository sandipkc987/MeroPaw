-- Push notification device tokens
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  device_id text not null,
  platform text not null,
  expo_push_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (owner_id, device_id)
);

alter table push_tokens add column if not exists expo_push_token text;

alter table push_tokens enable row level security;

drop policy if exists "Users manage their push tokens" on push_tokens;

create policy "Users manage their push tokens"
on push_tokens for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

