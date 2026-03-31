-- Add clinic_website and clinic_phone to vet_appointments for proper clinic organization
alter table vet_appointments add column if not exists clinic_website text;
alter table vet_appointments add column if not exists clinic_phone text;
