-- App data tables for pets and activities
-- Drop existing policies so this script is re-runnable
drop policy if exists "Users manage their pets" on pets;
drop policy if exists "Users manage their activities" on activities;
drop policy if exists "Users manage their notifications" on notifications;
drop policy if exists "Users manage their devices" on auth_devices;

create extension if not exists pgcrypto;

create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  bio text,
  breed text,
  age text,
  birth_date date,
  color text,
  microchip text,
  allergies text,
  photos text[] default '{}',
  created_at timestamptz default now()
);

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

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  type text not null,
  title text not null,
  note text,
  occurred_at timestamptz,
  created_at timestamptz default now()
);

alter table pets enable row level security;
alter table pet_profile_extras enable row level security;
alter table activities enable row level security;

create policy "Users manage their pets"
on pets for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their pet profile extras"
on pet_profile_extras for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their activities"
on activities for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

-- Memories (media + metadata)
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete set null,
  media_type text not null,
  storage_path text not null,
  title text,
  note text,
  width integer,
  height integer,
  is_favorite boolean default false,
  is_archived boolean default false,
  uploaded_at timestamptz,
  created_at timestamptz default now()
);

-- Reminders
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  title text not null,
  note text,
  scheduled_date date,
  scheduled_time time,
  date_key text,
  active boolean default true,
  repeating text,
  category text,
  time_zone text,
  has_notification boolean default true,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- Auth devices (used for new device sign-in alerts)
create table if not exists auth_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  device_id text not null,
  device_label text,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- Health records
create table if not exists health_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  type text not null,
  title text not null,
  date date,
  notes text,
  vet text,
  attachments jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Vet appointments
create table if not exists vet_appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  title text not null,
  appointment_date date not null,
  appointment_time time,
  clinic_name text,
  doctor_name text,
  address_line1 text,
  city text,
  state text,
  zip text,
  reason text,
  notes text,
  status text default 'scheduled',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Wellness inputs (manual score inputs)
create table if not exists wellness_inputs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  preventive jsonb,
  medical jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (owner_id, pet_id)
);

-- Weight history (used for wellness scoring)
create table if not exists pet_weight_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  weight numeric not null,
  recorded_at timestamptz not null,
  source text,
  created_at timestamptz default now(),
  unique (owner_id, pet_id, recorded_at, weight)
);

-- User profile (owner info)
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  owner_name text,
  owner_phone text,
  owner_email text,
  owner_legal_first_name text,
  owner_legal_last_name text,
  owner_preferred_first_name text,
  owner_residential_address text,
  owner_mailing_address text,
  owner_emergency_contact text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Expense receipts documents
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pet_id uuid references pets(id) on delete set null,
  file_path text not null,
  status text,
  created_at timestamptz default now()
);


alter table memories enable row level security;
alter table reminders enable row level security;
alter table notifications enable row level security;
alter table auth_devices enable row level security;
alter table health_records enable row level security;
alter table vet_appointments enable row level security;
alter table wellness_inputs enable row level security;
alter table pet_weight_history enable row level security;
alter table user_profiles enable row level security;
alter table documents enable row level security;
alter table expense_extractions enable row level security;
alter table expenses enable row level security;

create policy "Users manage their memories"
on memories for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their reminders"
on reminders for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their notifications"
on notifications for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their devices"
on auth_devices for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their health records"
on health_records for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their vet appointments"
on vet_appointments for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their wellness inputs"
on wellness_inputs for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their weight history"
on pet_weight_history for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their profiles"
on user_profiles for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

create policy "Users manage their documents"
on documents for all
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "Users manage their expenses"
on expenses for all
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "Users manage their expense extractions"
on expense_extractions for all
using (
  exists (
    select 1 from documents
    where documents.id = expense_extractions.document_id
      and documents.user_id::text = auth.uid()::text
  )
);

