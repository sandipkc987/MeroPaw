import { getSupabaseClient } from "@src/services/supabaseClient";
import * as FileSystemLegacy from "expo-file-system/legacy";

const MEMORY_BUCKET = "memories";
const RECEIPT_BUCKET = "receipts";
const HEALTH_BUCKET = "health-documents";
const verifiedBuckets: Record<string, boolean> = {};

function guessMimeType(uri: string, type?: "image" | "video" | "pdf"): string {
  if (type === "pdf") return "application/pdf";
  if (type === "video") return "video/mp4";
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, "").replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((cleaned.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (let i = 0; i < cleaned.length; i += 1) {
    const value = BASE64_ALPHABET.indexOf(cleaned[i]);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
    }
  }

  return bytes.slice(0, index);
}

async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await blob.arrayBuffer();
  } catch (error) {
    const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    if (!base64) {
      throw new Error("Unable to read file for upload.");
    }
    const bytes = base64ToUint8Array(base64);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
}

function normalizeTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  return value.length > 5 ? value.slice(0, 5) : value;
}

function publicUrl(bucket: string, path?: string | null): string | undefined {
  if (!path) return undefined;
  const supabase = getSupabaseClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || undefined;
}

async function signedOrPublicUrl(bucket: string, path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    // Fall back to public URL below.
  }
  return publicUrl(bucket, path);
}

async function ensureBucketExists(bucket: string): Promise<void> {
  if (verifiedBuckets[bucket]) return;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    // listBuckets can require elevated permissions; fall back to upload errors.
    return;
  }
  if (!data || data.length === 0) {
    // Some policies return an empty list even when buckets exist.
    return;
  }
  const exists = data.some(item => item.id === bucket || item.name === bucket);
  if (!exists) {
    throw new Error(`Storage bucket "${bucket}" not found. Create it in Supabase Storage.`);
  }
  verifiedBuckets[bucket] = true;
}

export async function uploadToBucket(
  bucket: string,
  fileUri: string,
  filePath: string,
  contentType?: string
): Promise<{ path: string; url: string }> {
  await ensureBucketExists(bucket);
  const supabase = getSupabaseClient();
  const arrayBuffer = await readFileAsArrayBuffer(fileUri);
  const { error } = await supabase.storage.from(bucket).upload(filePath, arrayBuffer, {
    contentType: contentType || guessMimeType(fileUri),
    upsert: false,
  });
  if (error) {
    if (error.message.toLowerCase().includes("row-level security")) {
      throw new Error("Upload blocked by storage policy. Allow inserts for this bucket.");
    }
    if (error.message.toLowerCase().includes("bucket not found")) {
      throw new Error(`Storage bucket "${bucket}" not found. Create it in Supabase Storage.`);
    }
    throw new Error(`Upload failed: ${error.message}`);
  }
  const url = publicUrl(bucket, filePath);
  if (!url) {
    throw new Error("Upload succeeded but public URL was missing.");
  }
  return { path: filePath, url };
}

export async function fetchReminders(userId: string, petId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("owner_id", userId)
    .eq("pet_id", petId)
    .order("scheduled_date", { ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    note: row.note || undefined,
    scheduledDate: row.scheduled_date || undefined,
    scheduledTime: normalizeTime(row.scheduled_time),
    dateKey: row.date_key || "",
    active: !!row.active,
    repeating: row.repeating || "",
    category: row.category || "other",
    timeZone: row.time_zone || undefined,
    hasNotification: row.has_notification ?? true,
    completed: !!row.completed,
  }));
}

export async function fetchNotifications(userId: string, petId?: string) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (petId) {
    query = query.or(`pet_id.is.null,pet_id.eq.${petId}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    message: row.message || undefined,
    timeISO: row.created_at,
    read: !!row.read_at,
    ctaLabel: row.cta_label || undefined,
    thumbUrl: row.thumb_url || undefined,
    metadata: row.metadata || undefined,
    petId: row.pet_id || undefined,
  }));
}

export async function insertNotification(
  userId: string,
  payload: {
    petId?: string;
    kind: string;
    title: string;
    message?: string;
    ctaLabel?: string;
    thumbUrl?: string;
    metadata?: Record<string, any>;
  }
) {
  const supabase = getSupabaseClient();
  const row = {
    owner_id: userId,
    pet_id: payload.petId || null,
    kind: payload.kind,
    title: payload.title,
    message: payload.message || null,
    cta_label: payload.ctaLabel || null,
    thumb_url: payload.thumbUrl || null,
    metadata: payload.metadata || null,
  };
  const { data, error } = await supabase
    .from("notifications")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNotificationRead(
  userId: string,
  notificationId: string,
  read: boolean
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", notificationId)
    .eq("owner_id", userId);
  if (error) throw error;
}

export async function hasMonthlyExpenseSummary(
  userId: string,
  petId: string,
  monthKey: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("owner_id", userId)
    .eq("pet_id", petId)
    .eq("kind", "expense")
    .contains("metadata", { type: "monthly_summary", monthKey })
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

export async function hasReminderNotification(
  userId: string,
  reminderId: string,
  type: "reminder_due" | "reminder_followup",
  dueAt: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("owner_id", userId)
    .eq("kind", "reminder")
    .contains("metadata", { type, reminderId, dueAt })
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

export async function insertReminder(userId: string, petId: string, reminder: any) {
  const supabase = getSupabaseClient();
  const payload = {
    owner_id: userId,
    pet_id: petId,
    title: reminder.title,
    note: reminder.note || null,
    scheduled_date: reminder.scheduledDate || null,
    scheduled_time: reminder.scheduledTime || null,
    date_key: reminder.dateKey || null,
    active: reminder.active ?? true,
    repeating: reminder.repeating || null,
    category: reminder.category || "other",
    time_zone: reminder.timeZone || null,
    has_notification: reminder.hasNotification ?? true,
    completed: reminder.completed ?? false,
  };
  const { data, error } = await supabase.from("reminders").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateReminder(userId: string, reminderId: string, updates: any) {
  const supabase = getSupabaseClient();
  const payload: Record<string, any> = {
    title: updates.title,
    note: updates.note,
    scheduled_date: updates.scheduledDate,
    scheduled_time: updates.scheduledTime,
    date_key: updates.dateKey,
    active: updates.active,
    repeating: updates.repeating,
    category: updates.category,
    time_zone: updates.timeZone,
    has_notification: updates.hasNotification,
    completed: updates.completed,
    updated_at: new Date().toISOString(),
  };
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
  const { error } = await supabase
    .from("reminders")
    .update(payload)
    .eq("id", reminderId)
    .eq("owner_id", userId);
  if (error) throw error;
}

export async function deleteReminder(userId: string, reminderId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", reminderId)
    .eq("owner_id", userId);
  if (error) throw error;
}

export async function fetchHealthRecords(userId: string, petId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("health_records")
    .select("*")
    .eq("owner_id", userId)
    .eq("pet_id", petId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return Promise.all(rows.map(async (row: any) => {
    const attachments = Array.isArray(row.attachments) ? row.attachments : undefined;
    const hydratedAttachments = attachments
      ? await Promise.all(
          attachments.map(async (attachment: any) => {
            if (!attachment?.path || attachment?.uri) return attachment;
            const uri = await signedOrPublicUrl(HEALTH_BUCKET, attachment.path);
            return uri ? { ...attachment, uri } : attachment;
          })
        )
      : undefined;
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      date: row.date,
      createdAt: row.created_at || undefined,
      notes: row.notes || undefined,
      vet: row.vet || undefined,
      pdfs: hydratedAttachments,
    };
  }));
}

export async function fetchVetAppointments(userId: string, petId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("vet_appointments")
    .select("*")
    .eq("owner_id", userId)
    .eq("pet_id", petId)
    .order("appointment_date", { ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    appointmentDate: row.appointment_date,
    appointmentTime: normalizeTime(row.appointment_time),
    clinicName: row.clinic_name || undefined,
    doctorName: row.doctor_name || undefined,
    addressLine1: row.address_line1 || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    zip: row.zip || undefined,
    reason: row.reason || undefined,
    notes: row.notes || undefined,
    status: row.status || "scheduled",
    createdAt: row.created_at || undefined,
  }));
}

export async function fetchWellnessInputs(userId: string, petId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("wellness_inputs")
    .select("*")
    .eq("owner_id", userId)
    .eq("pet_id", petId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  return {
    preventive: data.preventive || undefined,
    medical: data.medical || undefined,
    updatedAt: data.updated_at || undefined,
  };
}

export async function upsertWellnessInputs(userId: string, petId: string, inputs: any) {
  const supabase = getSupabaseClient();
  const payload = {
    owner_id: userId,
    pet_id: petId,
    preventive: inputs.preventive || null,
    medical: inputs.medical || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("wellness_inputs")
    .upsert(payload, { onConflict: "owner_id,pet_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertVetAppointment(userId: string, petId: string, appointment: any) {
  const supabase = getSupabaseClient();
  const payload = {
    owner_id: userId,
    pet_id: petId,
    title: appointment.title,
    appointment_date: appointment.appointmentDate,
    appointment_time: appointment.appointmentTime || null,
    clinic_name: appointment.clinicName || null,
    doctor_name: appointment.doctorName || null,
    address_line1: appointment.addressLine1 || null,
    city: appointment.city || null,
    state: appointment.state || null,
    zip: appointment.zip || null,
    reason: appointment.reason || null,
    notes: appointment.notes || null,
    status: appointment.status || "scheduled",
  };
  const { data, error } = await supabase.from("vet_appointments").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateVetAppointment(userId: string, appointmentId: string, updates: any) {
  const supabase = getSupabaseClient();
  const payload: any = {
    title: updates.title,
    appointment_date: updates.appointmentDate,
    appointment_time: updates.appointmentTime || null,
    clinic_name: updates.clinicName || null,
    doctor_name: updates.doctorName || null,
    address_line1: updates.addressLine1 || null,
    city: updates.city || null,
    state: updates.state || null,
    zip: updates.zip || null,
    reason: updates.reason || null,
    notes: updates.notes || null,
    status: updates.status || "scheduled",
    updated_at: new Date().toISOString(),
  };
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
  const { data, error } = await supabase
    .from("vet_appointments")
    .update(payload)
    .eq("id", appointmentId)
    .eq("owner_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVetAppointment(userId: string, appointmentId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("vet_appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("owner_id", userId);
  if (error) throw error;
}

export async function insertHealthRecord(userId: string, petId: string, record: any) {
  const supabase = getSupabaseClient();
  const payload = {
    owner_id: userId,
    pet_id: petId,
    type: record.type,
    title: record.title,
    date: record.date || null,
    notes: record.notes || null,
    vet: record.vet || null,
    attachments: record.pdfs || null,
  };
  const { data, error } = await supabase.from("health_records").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateHealthRecord(userId: string, recordId: string, updates: any) {
  const supabase = getSupabaseClient();
  const payload: any = {
    type: updates.type,
    title: updates.title,
    date: updates.date || null,
    notes: updates.notes || null,
    vet: updates.vet || null,
    attachments: updates.pdfs || null,
    updated_at: new Date().toISOString(),
  };
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
  const { data, error } = await supabase
    .from("health_records")
    .update(payload)
    .eq("id", recordId)
    .eq("owner_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHealthRecord(userId: string, recordId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("health_records")
    .delete()
    .eq("id", recordId)
    .eq("owner_id", userId);
  if (error) throw error;
}

export async function fetchExpenses(userId: string, petId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("pet_id", petId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return Promise.all(rows.map(async (row: any) => {
    const receiptPath = row.receipt_path || row.receipt?.path;
    const receiptUrl =
      (receiptPath ? await signedOrPublicUrl(RECEIPT_BUCKET, receiptPath) : undefined) ||
      row.receipt?.url ||
      row.receipt?.uri ||
      undefined;
    return {
      id: row.id,
      title: row.title || row.merchant || "Expense",
      amount: Number(row.amount ?? row.total ?? 0),
      category: row.category || "other",
      date: row.date || new Date().toISOString().split("T")[0],
      createdAt: row.created_at || undefined,
      notes: row.notes || undefined,
      receipt: receiptPath || row.receipt
        ? {
            type: row.receipt?.type || (row.receipt_type === "pdf" ? "pdf" : "image"),
            url: receiptUrl || "",
            name: row.receipt?.name || "Receipt",
            uri: row.receipt?.uri,
            path: receiptPath,
            documentId: row.document_id || row.receipt?.documentId,
          }
        : undefined,
    };
  }));
}

export async function insertExpense(userId: string, petId: string, expense: any) {
  const supabase = getSupabaseClient();
  const payload = {
    user_id: userId,
    pet_id: petId,
    title: expense.title,
    amount: expense.amount,
    category: expense.category,
    date: expense.date,
    notes: expense.notes || null,
    receipt: expense.receipt || null,
    receipt_path: expense.receipt?.path || null,
    receipt_type: expense.receipt?.type || null,
    document_id: expense.receipt?.documentId || null,
  };
  const { data, error } = await supabase.from("expenses").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateExpense(userId: string, expenseId: string, updates: any) {
  const supabase = getSupabaseClient();
  const payload: any = {
    title: updates.title,
    amount: updates.amount,
    category: updates.category,
    date: updates.date,
    notes: updates.notes || null,
    receipt: updates.receipt || null,
    receipt_path: updates.receipt?.path || null,
    receipt_type: updates.receipt?.type || null,
    document_id: updates.receipt?.documentId || null,
  };
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
  const { data, error } = await supabase
    .from("expenses")
    .update(payload)
    .eq("id", expenseId)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(userId: string, expenseId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchReceipts(userId: string, petId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("pet_id", petId)
    .not("receipt_path", "is", null);
  if (error) throw error;
  const rows = data || [];
  return Promise.all(rows.map(async (row: any) => {
    const receiptPath = row.receipt_path || row.receipt?.path;
    const receiptUrl =
      (receiptPath ? await signedOrPublicUrl(RECEIPT_BUCKET, receiptPath) : undefined) ||
      row.receipt?.url ||
      row.receipt?.uri ||
      undefined;
    return {
      id: row.id,
      title: row.title || row.merchant || "Expense",
      amount: Number(row.amount ?? row.total ?? 0),
      date: row.date || new Date().toISOString().split("T")[0],
      category: row.category || "other",
      receipt: {
        type: row.receipt?.type || (row.receipt_type === "pdf" ? "pdf" : "image"),
        url: receiptUrl || "",
        name: row.receipt?.name || "Receipt",
      },
    };
  }));
}

export async function uploadHealthAttachment(
  userId: string,
  fileUri: string,
  fileName: string
): Promise<{ name: string; path: string; uri: string }> {
  const fileExt = fileName.split(".").pop() || "pdf";
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  await ensureBucketExists(HEALTH_BUCKET);
  const { path } = await uploadToBucket(HEALTH_BUCKET, fileUri, filePath, guessMimeType(fileUri, "pdf"));
  const uri = (await signedOrPublicUrl(HEALTH_BUCKET, path)) || "";
  return { name: fileName, path, uri };
}

export async function getHealthAttachmentViewUrl(path: string) {
  return signedOrPublicUrl(HEALTH_BUCKET, path);
}

export async function uploadProfilePhoto(
  userId: string,
  petId: string,
  fileUri: string,
  type: "avatar" | "cover"
): Promise<{ path: string; url: string }> {
  const fileExt = fileUri.split(".").pop()?.split("?")[0] || "jpg";
  const filePath = `profiles/${userId}/${petId}/${type}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;
  await ensureBucketExists(MEMORY_BUCKET);
  return uploadToBucket(MEMORY_BUCKET, fileUri, filePath, guessMimeType(fileUri, "image"));
}

export function getMemoryPublicUrl(path: string) {
  return publicUrl(MEMORY_BUCKET, path);
}

export function getReceiptPublicUrl(path: string) {
  return publicUrl(RECEIPT_BUCKET, path);
}

export async function fetchUserProfile(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function upsertUserProfile(userId: string, profile: any) {
  const supabase = getSupabaseClient();
  const payload = {
    owner_id: userId,
    owner_name: profile.ownerName || null,
    owner_phone: profile.ownerPhone || null,
    owner_email: profile.ownerEmail || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("user_profiles").upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export type PetProfileExtras = {
  personality?: {
    traits: { key: string; intensity: number }[];
    favoriteActivity?: string;
    summary?: string;
  };
  wellness?: {
    mood?: string;
    metrics?: {
      weight?: string;
      activity?: string;
      vaccine?: string;
      allergies?: string;
    };
  };
  achievements?: { label: string; iconName: string }[];
};

export async function fetchPetProfileExtras(userId: string, petId: string): Promise<PetProfileExtras | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("pet_profile_extras")
    .select("personality, wellness, achievements")
    .eq("owner_id", userId)
    .eq("pet_id", petId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    personality: data.personality || undefined,
    wellness: data.wellness || undefined,
    achievements: data.achievements || undefined,
  };
}

export async function upsertPetProfileExtras(
  userId: string,
  petId: string,
  payload: PetProfileExtras
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("pet_profile_extras")
    .upsert(
      {
        owner_id: userId,
        pet_id: petId,
        personality: payload.personality || null,
        wellness: payload.wellness || null,
        achievements: payload.achievements || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,pet_id" }
    );
  if (error) throw error;
}

