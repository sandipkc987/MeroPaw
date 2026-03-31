import { Platform } from "react-native";
import * as Calendar from "expo-calendar";
import storage from "@src/utils/storage";

const CALENDAR_ID_KEY = "@kasper_calendar_id";
const SETTINGS_KEY = "@kasper_settings";

export interface VetAppointmentForCalendar {
  title?: string | null;
  appointment_date: string;
  appointment_time?: string | null;
  clinic_name?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  reason?: string | null;
  notes?: string | null;
}

function isCalendarAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/**
 * Returns whether calendar sync is available on this device (iOS/Android only).
 */
export async function isCalendarSyncAvailable(): Promise<boolean> {
  if (!isCalendarAvailable()) return false;
  try {
    return await Calendar.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Request calendar permission. Returns true if granted.
 */
export async function requestCalendarPermission(): Promise<boolean> {
  if (!isCalendarAvailable()) return false;
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Get the calendar id to use for vet events. Uses stored id if set, otherwise default calendar.
 */
export async function getCalendarId(): Promise<string | null> {
  if (!isCalendarAvailable()) return null;
  try {
    const stored = await storage.getItem(CALENDAR_ID_KEY);
    if (stored) return stored;

    const defaultCal = await Calendar.getDefaultCalendarAsync();
    if (defaultCal?.id) {
      await storage.setItem(CALENDAR_ID_KEY, defaultCal.id);
      return defaultCal.id;
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.find((c) => c.allowsModifications !== false);
    if (writable?.id) {
      await storage.setItem(CALENDAR_ID_KEY, writable.id);
      return writable.id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Store the chosen calendar id (e.g. after user picks one).
 */
export async function setCalendarId(calendarId: string): Promise<void> {
  await storage.setItem(CALENDAR_ID_KEY, calendarId);
}

function buildStartEnd(appointment: VetAppointmentForCalendar): { start: Date; end: Date } {
  const dateStr = appointment.appointment_date;
  const timeStr = appointment.appointment_time;
  const date = new Date(dateStr);
  if (timeStr && /^\d{1,2}(:\d{2})?/.test(timeStr)) {
    const [hours, minutes = 0] = timeStr.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
  } else {
    date.setHours(9, 0, 0, 0);
  }
  const start = new Date(date);
  const end = new Date(date.getTime() + 60 * 60 * 1000);
  return { start, end };
}

function buildTitle(appointment: VetAppointmentForCalendar): string {
  const title = appointment.title?.trim();
  const clinic = appointment.clinic_name?.trim();
  if (title && clinic) return `Vet: ${title} · ${clinic}`;
  if (title) return `Vet: ${title}`;
  if (clinic) return `Vet: ${clinic}`;
  return "Vet appointment";
}

function buildLocation(appointment: VetAppointmentForCalendar): string {
  const parts = [
    appointment.address_line1,
    appointment.city,
    appointment.state,
    appointment.zip,
  ].filter(Boolean);
  return parts.join(", ") || "";
}

function buildNotes(appointment: VetAppointmentForCalendar): string {
  const parts: string[] = [];
  if (appointment.reason) parts.push(`Reason: ${appointment.reason}`);
  if (appointment.notes) parts.push(appointment.notes);
  return parts.join("\n") || "";
}

/**
 * Create a calendar event for a vet appointment. Returns the event id, or null on failure.
 */
export async function createVetCalendarEvent(
  calendarId: string,
  appointment: VetAppointmentForCalendar
): Promise<string | null> {
  if (!isCalendarAvailable()) return null;
  try {
    const { start, end } = buildStartEnd(appointment);
    const eventId = await Calendar.createEventAsync(calendarId, {
      title: buildTitle(appointment),
      startDate: start,
      endDate: end,
      location: buildLocation(appointment) || undefined,
      notes: buildNotes(appointment) || undefined,
    });
    return eventId ?? null;
  } catch {
    return null;
  }
}

/**
 * Update an existing calendar event for a vet appointment.
 */
export async function updateVetCalendarEvent(
  eventId: string,
  appointment: VetAppointmentForCalendar
): Promise<boolean> {
  if (!isCalendarAvailable()) return false;
  try {
    const { start, end } = buildStartEnd(appointment);
    await Calendar.updateEventAsync(eventId, {
      title: buildTitle(appointment),
      startDate: start,
      endDate: end,
      location: buildLocation(appointment) || undefined,
      notes: buildNotes(appointment) || undefined,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteVetCalendarEvent(eventId: string): Promise<boolean> {
  if (!isCalendarAvailable()) return false;
  try {
    await Calendar.deleteEventAsync(eventId);
    return true;
  } catch {
    return false;
  }
}

/**
 * If vet sync is enabled in settings, returns the calendar id to use; otherwise null.
 */
export async function getVetSyncCalendarId(): Promise<string | null> {
  if (!isCalendarAvailable()) return null;
  try {
    const stored = await storage.getItem(SETTINGS_KEY);
    if (!stored) return null;
    const settings = JSON.parse(stored) as { vetSync?: boolean };
    if (!settings.vetSync) return null;
    return getCalendarId();
  } catch {
    return null;
  }
}
