-- Vet appointments table: stores all vet visits (scheduled, past, canceled)
-- Run this in Supabase SQL Editor to ensure the schema supports history

-- Create table if it doesn't exist (e.g. fresh project)
create table if not exists vet_appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid references pets(id) on delete cascade,
  title text not null,
  appointment_date date not null,
  appointment_time time,
  clinic_name text,
  clinic_website text,
  clinic_phone text,
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

-- Enable RLS
alter table vet_appointments enable row level security;

-- Policy: users manage their own appointments
drop policy if exists "Users manage their vet appointments" on vet_appointments;
create policy "Users manage their vet appointments"
  on vet_appointments for all
  using (auth.uid()::text = owner_id::text)
  with check (auth.uid()::text = owner_id::text);

-- Add clinic_website and clinic_phone if table already existed without them
alter table vet_appointments add column if not exists clinic_website text;
alter table vet_appointments add column if not exists clinic_phone text;
