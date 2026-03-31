-- Add gender and service animal fields to pets table
-- Run this migration in your Supabase SQL editor or via: supabase db push

alter table pets
  add column if not exists gender text,
  add column if not exists is_service_animal boolean default false;

comment on column pets.gender is 'Pet gender, e.g. Male, Female';
comment on column pets.is_service_animal is 'Whether the pet is a registered/service animal';
