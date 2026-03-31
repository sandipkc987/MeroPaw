import { getSupabaseClient, supabaseAnonKey, supabaseUrl } from "@src/services/supabaseClient";

export type ClinicalSummaryExtraction = {
  vendor?: string;
  textLength?: number;
  needsOcr?: boolean;
  usedOcr?: boolean;
  normalized?: {
    weight?: { value: number; unit?: string; confidence: number };
    heartRate?: { value: number; unit?: string; confidence: number };
    respiratoryRate?: { value: number; unit?: string; confidence: number };
    attitude?: { value: string; confidence: number };
    visitDate?: { value: string; confidence: number };
    visitTitle?: { value: string; confidence: number };
    visitType?: { value: string; confidence: number };
    doctorName?: { value: string; confidence: number };
    clinicName?: { value: string; confidence: number };
    vaccinations?: Array<{ name: string; date?: string; dueDate?: string }>;
  };
};

export default async function analyzeClinicalSummary(
  filePath: string,
  rawText?: string,
  petId?: string
): Promise<ClinicalSummaryExtraction> {
  const supabase = getSupabaseClient();
  let { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    const refreshed = await supabase.auth.refreshSession();
    sessionData = refreshed.data;
  }
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error("Not signed in. Please sign in again.");
  }
  const callFunction = async (token: string) => {
    return fetch(`${supabaseUrl}/functions/v1/parse-clinical-summary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
    body: JSON.stringify({ filePath, rawText, petId }),
    });
  };

  let response = await callFunction(accessToken);
  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    const retryToken = refreshed.data?.session?.access_token;
    if (retryToken) {
      response = await callFunction(retryToken);
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Clinical summary extraction failed: ${errText || response.statusText}`);
  }
  return (await response.json()) as ClinicalSummaryExtraction;
}

export async function generateHealthSummary(rawText: string, petName?: string): Promise<string> {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Text too short to summarize (min 50 characters)");
  }
  const supabase = getSupabaseClient();
  let { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    const refreshed = await supabase.auth.refreshSession();
    sessionData = refreshed.data;
  }
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error("Not signed in. Please sign in again.");
  }
  const callFn = async (token: string) =>
    fetch(`${supabaseUrl}/functions/v1/generate-health-summary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rawText: rawText.trim(), petName: petName || "your pet" }),
    });
  let response = await callFn(accessToken);
  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    const retryToken = refreshed.data?.session?.access_token;
    if (retryToken) response = await callFn(retryToken);
  }
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Summary generation failed: ${errText || response.statusText}`);
  }
  const data = (await response.json()) as { summary?: string };
  return data?.summary ?? "";
}

