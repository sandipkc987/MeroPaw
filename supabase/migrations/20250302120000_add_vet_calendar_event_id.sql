-- Store device calendar event id for vet appointments so we can update/delete when user edits in app
alter table vet_appointments
  add column if not exists calendar_event_id text;

comment on column vet_appointments.calendar_event_id is 'Device calendar event id (iOS/Android) when vet sync is enabled';
