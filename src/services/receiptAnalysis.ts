import { Platform } from "react-native";
import { getSupabaseClient } from "./supabaseClient";
import storage from "@src/utils/storage";
import { FunctionsHttpError } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system/legacy";

export interface ReceiptExtraction {
  merchant?: string;
  amount?: number;
  date?: string;
  currency?: string;
  category?: string;
  items?: string[];
  documentId?: string;
  receiptPath?: string;
  receiptType?: "image" | "pdf";
}

function guessMimeType(uri: string, type: "image" | "pdf"): string {
  if (type === "pdf") return "application/pdf";
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function getCurrentUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData?.session?.user;
  if (sessionUser?.id) return sessionUser.id;

  // If we get here, Supabase has no active session. RLS will always fail.
  await storage.removeItem("kasper_user");
  await storage.removeItem("kasper_onboarding_complete");
  throw new Error("Not signed in. Please log out and log back in.");
}

/**
 * Create a Blob from base64 using data URI + fetch.
 * React Native on iOS does not support new Blob([ArrayBuffer/Uint8Array]), so we must
 * use fetch(dataUri).blob() instead.
 */
async function base64ToBlobAsync(base64: string, mimeType: string): Promise<Blob> {
  const clean = base64.replace(/^data:image\/\w+;base64,/, "");
  const dataUri = `data:${mimeType};base64,${clean}`;
  const response = await fetch(dataUri);
  const blob = await response.blob();
  return blob;
}

/** Result of reading a URI: blob for upload, and base64 when we read via FileSystem (for inline send). */
async function readUriAsBlobAndBase64(uri: string, mimeType: string): Promise<{ blob: Blob; base64?: string }> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return { blob };
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) throw new Error("Could not read receipt file.");
    const blob = await base64ToBlobAsync(base64, mimeType);
    return { blob, base64 };
  } catch (e) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return { blob };
  }
}

/** Get base64 from blob without using arrayBuffer() (not available on RN iOS/Hermes). */
function blobToBase64Safe(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const dataUrl = typeof fr.result === "string" ? fr.result : "";
        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
        resolve(base64);
      };
      fr.onerror = () => reject(fr.error || new Error("FileReader failed"));
      fr.readAsDataURL(blob);
    });
  }
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
      }
      return typeof btoa !== "undefined" ? btoa(binary) : "";
    });
  }
  return Promise.reject(new Error("Cannot encode receipt for upload on this device. Try again or use a different photo."));
}

export async function analyzeReceipt(
  uri: string,
  type: "image" | "pdf",
  options?: { petId?: string; saveExpense?: boolean; base64?: string }
): Promise<ReceiptExtraction> {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const mimeType = guessMimeType(uri, type);
  const fileExt = type === "pdf" ? "pdf" : mimeType.split("/")[1] || "jpg";
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  let blob: Blob;
  let contentBase64: string | undefined;

  if (type === "image" && options?.base64) {
    blob = await base64ToBlobAsync(options.base64, mimeType);
    contentBase64 = options.base64.replace(/^data:image\/\w+;base64,/, "");
  } else {
    const result = await readUriAsBlobAndBase64(uri, mimeType);
    blob = result.blob;
    contentBase64 = result.base64;
  }

  if (!blob || blob.size === 0) {
    throw new Error("Receipt file is empty or could not be read. Try selecting the image again.");
  }

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(filePath, blob, { contentType: mimeType, upsert: false });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: documentRow, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      pet_id: options?.petId || null,
      file_path: filePath,
      status: "pending",
    })
    .select()
    .single();

  if (docError || !documentRow) {
    throw new Error(`Document insert failed: ${docError?.message}`);
  }

  // When we don't have base64 yet (e.g. fetch fallback), try FileReader (RN-safe; no arrayBuffer)
  if (!contentBase64) {
    try {
      contentBase64 = await blobToBase64Safe(blob);
    } catch {
      // Edge function will fall back to storage download
    }
  }

  const { data, error } = await supabase.functions.invoke("parse-receipt", {
    body: {
      filePath,
      documentId: documentRow.id,
      mimeType,
      petId: options?.petId,
      saveExpense: options?.saveExpense,
      ...(contentBase64 ? { contentBase64 } : {}),
    },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError && error.context) {
      try {
        const body = await (error.context as Response).json();
        if (body?.error && typeof body.error === "string") message = body.error;
      } catch {
        // keep generic message
      }
    }
    throw new Error(`Receipt analysis failed: ${message}`);
  }

  return {
    merchant: data?.normalized?.merchant || undefined,
    amount: typeof data?.normalized?.total === "number" ? data.normalized.total : undefined,
    date: data?.normalized?.date || undefined,
    currency: data?.normalized?.currency || undefined,
    category: data?.normalized?.category || undefined,
    items: data?.normalized?.items || undefined,
    documentId: data?.documentId || documentRow.id,
    receiptPath: data?.receiptPath || filePath,
    receiptType: type,
  };
}

export default analyzeReceipt;

