-- In-app notifications + auth device tracking

-- Notifications (in-app feed)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  kind text not null,
  title text not null,
  message text,
  cta_label text,
  thumb_url text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

drop policy if exists "Users manage their notifications" on notifications;

create policy "Users manage their notifications"
on notifications for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

-- Auth devices (used for new device sign-in alerts)
create table if not exists auth_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  device_id text not null,
  device_label text,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

alter table auth_devices enable row level security;

drop policy if exists "Users manage their devices" on auth_devices;

create policy "Users manage their devices"
on auth_devices for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

