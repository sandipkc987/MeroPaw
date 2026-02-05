import { getSupabaseClient } from "./supabaseClient";
import storage from "@src/utils/storage";

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

export async function analyzeReceipt(
  uri: string,
  type: "image" | "pdf",
  options?: { petId?: string; saveExpense?: boolean }
): Promise<ReceiptExtraction> {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const mimeType = guessMimeType(uri, type);
  const fileExt = type === "pdf" ? "pdf" : mimeType.split("/")[1] || "jpg";
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const response = await fetch(uri);
  const blob = await response.blob();

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

  const { data, error } = await supabase.functions.invoke("parse-receipt", {
    body: {
      filePath,
      documentId: documentRow.id,
      mimeType,
      petId: options?.petId,
      saveExpense: options?.saveExpense,
    },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (error) {
    throw new Error(`Receipt analysis failed: ${error.message}`);
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

