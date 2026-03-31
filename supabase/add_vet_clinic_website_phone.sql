-- Run this in Supabase SQL Editor to add clinic_website and clinic_phone to vet_appointments
-- (Required if you already ran SUPABASE_APP_SCHEMA.sql before these columns were added)

alter table vet_appointments add column if not exists clinic_website text;
alter table vet_appointments add column if not exists clinic_phone text;
