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
    visitType?: { value: string; confidence: number };
    doctorName?: { value: string; confidence: number };
    clinicName?: { value: string; confidence: number };
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

