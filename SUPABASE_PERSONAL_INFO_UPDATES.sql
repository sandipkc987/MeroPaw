-- Personal info fields for user_profiles
alter table user_profiles
  add column if not exists owner_legal_first_name text,
  add column if not exists owner_legal_last_name text,
  add column if not exists owner_preferred_first_name text,
  add column if not exists owner_residential_address text,
  add column if not exists owner_mailing_address text,
  add column if not exists owner_emergency_contact text;

