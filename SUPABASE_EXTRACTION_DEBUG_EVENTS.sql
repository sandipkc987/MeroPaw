-- Extraction instrumentation table
create table if not exists extraction_debug_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid,
  pet_id uuid,
  file_path text,
  extractor_version text,
  missing_fields text[],
  header_preview text,
  unknown_labels jsonb,
  extracted jsonb,
  candidates jsonb
);

alter table extraction_debug_events enable row level security;

create policy "Users manage their extraction debug events"
on extraction_debug_events for all
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

