-- Saved vet per user+pet: syncs across web and iOS (replaces local-only storage)
create table if not exists saved_vets (
  owner_id uuid not null,
  pet_id uuid not null references pets(id) on delete cascade,
  clinic_name text not null,
  address text,
  website text,
  phone text,
  updated_at timestamptz default now(),
  primary key (owner_id, pet_id)
);

alter table saved_vets enable row level security;

drop policy if exists "Users manage their saved vet" on saved_vets;
create policy "Users manage their saved vet"
  on saved_vets for all
  using (auth.uid()::text = owner_id::text)
  with check (auth.uid()::text = owner_id::text);
