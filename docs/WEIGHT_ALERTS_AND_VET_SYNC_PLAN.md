# Plan: Weight Change Alerts & Vet Appointment Sync

This doc lays out how to make both Health & Wellness features actually work.

---

## 1. Weight Change Alerts

### Goal
When the user logs a new weight and it differs from the previous weight by **±X%** (X = sensitivity 1–15% from settings), send an in-app notification (and optionally push): e.g. *"Weight changed by +8% from last reading."*

### What we already have
- **Settings**: `weightAlert` (on/off) and `weightThreshold` (1–15%) in `@kasper_settings` (AsyncStorage), saved from Health & Wellness settings.
- **Data**: `pet_weight_history` in Supabase; `fetchWeightHistory`, `upsertWeightHistory` in `supabaseData.ts`.
- **UI**: Weight is added in **HealthScreen** via `addWeightEntry(entry)` → `upsertWeightHistory(user.id, activePetId, [entry])` (fire-and-forget).

### What we need to add

#### Step 1: Read settings when checking
- In the client, read `@kasper_settings` to get `weightAlert` and `weightThreshold` when we’re about to run the check (or pass them from the screen).

#### Step 2: Run the check after a new weight is saved
- **Where**: After a successful `upsertWeightHistory(…)` for the new entry (in the same flow that calls `addWeightEntry`).
- **Logic**:
  1. If `!weightAlert` → do nothing.
  2. Fetch last **2** weights for this pet (e.g. reuse `fetchWeightHistory` and take first two, or add a small `fetchLastWeights(userId, petId, limit: 2)`).
  3. If we have fewer than 2 entries → do nothing (no “previous” to compare).
  4. Compute: `prevWeight` = older of the two, `newWeight` = newer;  
     `changePct = ((newWeight - prevWeight) / prevWeight) * 100`.
  5. If `Math.abs(changePct) >= weightThreshold` → call `insertNotification(userId, { petId, kind: "health", title: "Weight change", message: `Weight changed by ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% from previous.` })`.
  6. Optional: trigger push via existing FCM flow if you send push for health notifications.

#### Step 3: Where to put the logic
- **Option A (recommended)**: New helper in the app, e.g. `checkWeightChangeAndNotify(userId, petId, settings)`:
  - Called from **HealthScreen** after `upsertWeightHistory(…)` resolves (and after local state is updated).
  - HealthScreen (or a small hook) reads `@kasper_settings` and passes `{ weightAlert, weightThreshold }`, or the helper reads settings itself.
- **Option B**: Integrate the check inside a wrapper in `supabaseData.ts` that does upsert + fetch last 2 + notify. That would require passing settings from the client (Supabase layer shouldn’t read AsyncStorage).

#### Edge cases
- **First weight ever**: Only one row → no notification (by design).
- **Same weight logged again**: Change 0% → below any threshold → no notification.
- **Multiple entries in one batch**: If `upsertWeightHistory` is called with several entries, run the check once after the batch, using the two most recent from DB (newest vs previous).

### Implementation checklist (Weight) — DONE
- [x] Added `checkWeightChangeAndNotify(userId, petId)` in `src/services/weightChangeAlert.ts`.
- [x] HealthScreen calls it after `upsertWeightHistory` in both `addWeightEntry` and `loadWeightHistory` merge path.
- [ ] (Optional) Ensure push notifications are sent for this health notification if your app already supports health push.

---

## 2. Vet Appointment Sync (device calendar)

### Goal
- **Connect Calendar**: User taps “Connect Calendar” → we request calendar permission and (optionally) let them pick a calendar. We then **export** vet appointments from the app to the device calendar so they appear in the system Calendar app and can use system reminders.
- **Ongoing**: When the user creates/updates/deletes a vet appointment in the app, we create/update/delete the corresponding event on the device calendar.

### What we already have
- **Data**: `vet_appointments` in Supabase; `insertVetAppointment`, `updateVetAppointment`, `deleteVetAppointment`, `fetchVetAppointments` in `supabaseData.ts`.
- **UI**: Appointments are created/edited in **ScheduleVetVisitScreen** and **HealthScreen**; “Connect Calendar” and vet sync toggle live in **HealthWellnessSettingsScreen**.
- **Dependencies**: No calendar library yet; need **expo-calendar** (or similar) for a single API across iOS/Android.

### What we need to add

#### Step 1: Add expo-calendar
- Install: `npx expo install expo-calendar`.
- Configure:
  - **iOS**: In `app.json` / `app.config.js`, add calendar usage descriptions (e.g. “Meropaw adds vet appointments to your calendar”).
  - **Android**: Calendar permissions and (if needed) `READ_CALENDAR` / `WRITE_CALENDAR` in the config plugin.
- **Web**: expo-calendar may not support web; in that case, hide “Connect Calendar” / vet sync on web or show “Coming soon on web”.

#### Step 2: Calendar service (client)
- New module, e.g. `src/services/calendarSync.ts`:
  - **requestCalendarPermission()**: Use expo-calendar’s permission API; return granted/denied.
  - **getDefaultCalendar()** (or “target” calendar): Get writable calendar(s), let user pick one or use default.
  - **createCalendarEvent(calendarId, { title, startDate, endDate, notes, location })**: Create one event; title could be e.g. `Vet: <clinic/doctor>`.
  - **updateCalendarEvent(eventId, …)**: Update existing event.
  - **deleteCalendarEvent(eventId)**: Remove event.
  - **exportAppointmentToCalendar(calendarId, appointment)**: Map `VetAppointment` → event fields, call create. Store the returned **event id** somewhere (e.g. in a new column `calendar_event_id` on `vet_appointments`, or in local-only storage keyed by appointment id).
- Storing **calendar_event_id** in the DB is best so that when the user edits/deletes the appointment in the app we can update/delete the right event. So:
  - Add column `vet_appointments.calendar_event_id` (nullable text) via migration.
  - When creating an event, save the id to the appointment row (via `updateVetAppointment` or extend `insertVetAppointment` to accept it).

#### Step 3: “Connect Calendar” flow
- In **HealthWellnessSettingsScreen**, when user taps “Connect Calendar”:
  1. Call `requestCalendarPermission()`. If denied, show an alert and stop.
  2. Get default/target calendar (e.g. `getDefaultCalendar()`).
  3. Set `vetSync` to true and persist (already have this).
  4. **Backfill**: For each existing vet appointment (fetch from Supabase), if it doesn’t have `calendar_event_id`, create a calendar event and save the event id to the appointment row.
  5. Show success: “Calendar connected. Your vet appointments will appear in your calendar.”

#### Step 4: Sync on create/update/delete
- When **creating** a vet appointment (ScheduleVetVisitScreen / HealthScreen):
  - After `insertVetAppointment(…)` succeeds, if vet sync is enabled (read from `@kasper_settings`), call `exportAppointmentToCalendar(calendarId, appointment)` then `updateVetAppointment(userId, newAppointment.id, { calendar_event_id: eventId })`.
- When **updating** an appointment:
  - If sync enabled and appointment has `calendar_event_id` → update that event; if no `calendar_event_id` → create and save id.
- When **deleting** (or canceling and you treat as delete):
  - If appointment has `calendar_event_id` → delete that event from the calendar, then clear `calendar_event_id` on the row (or leave it and just delete the event).

#### Step 5: Calendar id storage
- After “Connect Calendar”, we need to know **which calendar** to use on this device. Options:
  - Store in AsyncStorage, e.g. `@kasper_calendar_id` = default calendar id (and optionally calendar name). Read this in calendarSync when creating/updating events.

#### Step 6: Reminders for upcoming vet visits
- You already have vet appointments in Supabase and in-app UI. Optional enhancement:
  - Use **expo-notifications** (or your existing push flow) to schedule a local notification 1 day before (and/or 1 hour before) each upcoming appointment. This can be independent of the device calendar (or in addition to it). Could be a small background job or run when the app opens: fetch upcoming appointments, schedule local notifications for those that don’t have one yet.

### Implementation checklist (Vet sync) — DONE
- [x] Added `expo-calendar`; configured app.json (expo-calendar plugin, NSCalendarsUsageDescription, READ/WRITE_CALENDAR).
- [x] Migration `20250302120000_add_vet_calendar_event_id.sql`: added `calendar_event_id` to `vet_appointments`.
- [x] `src/services/calendarSync.ts`: permission, getCalendarId, create/update/delete event, getVetSyncCalendarId.
- [x] HealthWellnessSettingsScreen “Connect Calendar”: request permission, backfill existing appointments, persist vetSync.
- [x] ScheduleVetVisitScreen: after insert/update create or update calendar event; on cancel delete event and clear `calendar_event_id`.
- [ ] (Optional) Local notifications for “vet visit tomorrow” / “vet visit in 1 hour” using expo-notifications.

---

## Order of implementation

1. **Weight Change Alerts** – small, client-only, no new deps. Do first.
2. **Vet Appointment Sync** – add expo-calendar, migration, calendar service, then wire Connect Calendar and create/update/delete flows.

---

## Your next steps

1. **Apply the migration**  
   Run the new migration so `vet_appointments.calendar_event_id` exists:
   - `supabase db push` or run `supabase/migrations/20250302120000_add_vet_calendar_event_id.sql` in the Supabase SQL editor.

2. **Rebuild the native app** (for vet sync)  
   Calendar permissions were added to app.json; rebuild so they take effect:
   - `npx expo run:ios` or `npx expo run:android`.

3. **Test**
   - **Weight:** Log two weights (e.g. 10 kg then 11 kg). With sensitivity 5%, you should get an in-app “Weight change” notification.
   - **Vet sync:** On device/simulator, open Health & Wellness → tap “Connect Calendar” → allow access. Add or edit a vet appointment in Schedule Vet Visit; it should appear in the system Calendar app. Cancel an appointment; the calendar event should be removed.
