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

alter table wellness_inputs enable row level security;

create policy "Users manage their wellness inputs"
on wellness_inputs for all
using (auth.uid()::text = owner_id::text)
with check (auth.uid()::text = owner_id::text);

