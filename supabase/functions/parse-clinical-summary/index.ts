// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

// Required by pdfjs even when workers are disabled.
// Use an inline empty worker to avoid external module loading in edge runtimes.
const INLINE_WORKER_SRC = "data:application/javascript;base64,";
const ensureWorkerSrc = () => {
  const current = pdfjsLib?.GlobalWorkerOptions?.workerSrc;
  if (!current) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = INLINE_WORKER_SRC;
  }
  return pdfjsLib?.GlobalWorkerOptions?.workerSrc;
};
ensureWorkerSrc();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VITAL_HEADERS = [
  "HEALTH STATUS",
  "VITALS",
  "TRIAGE",
  "PHYSICAL EXAM",
  "OBJECTIVE",
  "PE:",
];
const SECTION_ENDERS = [
  "PRESENTING PROBLEM",
  "ASSESSMENT",
  "PLAN",
  "HISTORY",
  "SUBJECTIVE",
];

const EXTRACTOR_VERSION = "2026-02-04-instrumented-v1";

function normalizeText(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeaderBlock(text: string): string {
  const match = text.match(/^[\s\S]*?\bCLINICAL\s+SUMMARY\b/);
  return (match ? match[0] : text.slice(0, 1800)).trim();
}

function extractHealthStatusSection(text: string): string | null {
  const match = text.match(
    /\bHEALTH\s+STATUS\b([\s\S]*?)(\bPRESENTING\s+PROBLEM\b|\bPHYSICAL\s+EXAMINATION\b|\bHISTORY\b|$)/
  );
  return match ? match[1].trim() : null;
}

function joinSplitDigits(value: string) {
  return value
    .replace(/\b(\d)\s+(\d{2})\b/g, "$1$2")
    .replace(/\b(\d{2})\s+(\d)\b/g, "$1$2");
}

function toInt(value?: string): number | null {
  const num = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function isPlausibleHeartRate(value: number) {
  return value >= 40 && value <= 240;
}

function isPlausibleRespRate(value: number) {
  return value >= 5 && value <= 100;
}

function isPlausibleWeightLb(value: number) {
  return value >= 0.5 && value <= 250;
}

type Candidate = { value: any; confidence: number; reason?: string; source?: string };

function pickBestStrict(candidates: Candidate[]): Candidate | undefined {
  if (!candidates || candidates.length === 0) return undefined;
  const filtered = candidates.filter((candidate) => {
    if (!candidate) return false;
    if (candidate.value == null) return false;
    return String(candidate.value).trim().length > 0;
  });
  if (filtered.length === 0) return undefined;
  return filtered.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
}

function getMissingFields(payload: Record<string, any>) {
  const missing: string[] = [];
  if (!payload?.weight?.value) missing.push("weight");
  if (!payload?.heartRate?.value) missing.push("heartRate");
  if (!payload?.respiratoryRate?.value) missing.push("respiratoryRate");
  if (!payload?.attitude?.value) missing.push("attitude");
  if (!payload?.visitDate?.value) missing.push("visitDate");
  if (!payload?.doctorName?.value) missing.push("doctorName");
  if (!payload?.clinicName?.value) missing.push("clinicName");
  return missing;
}

function buildHeaderPreview(text: string) {
  return text.slice(0, 1200);
}

function findUnknownLabels(text: string) {
  const known = new Set([
    "HR",
    "HEART RATE",
    "PULSE",
    "RR",
    "RESP",
    "RESPIRATION",
    "RESPIRATORY RATE",
    "WEIGHT",
    "WT",
    "BW",
    "BODY WEIGHT",
    "ATTITUDE",
    "MENTATION",
    "RECORD DATE",
    "VISIT DATE",
    "APPOINTMENT DATE",
    "DATE",
  ]);
  const results: { label: string; snippet: string }[] = [];
  const regex = /\b([A-Z][A-Z\s]{2,30})\b\s*[:\-]\s*(\d{1,4}(?:\.\d+)?)\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const label = match[1].trim().replace(/\s+/g, " ");
    if (known.has(label)) continue;
    const start = Math.max(0, match.index - 40);
    const end = Math.min(text.length, match.index + 60);
    results.push({ label, snippet: text.slice(start, end) });
  }
  return results.slice(0, 20);
}

async function logExtractionDebug(params: {
  admin: ReturnType<typeof createClient>;
  userId: string | null;
  petId?: string;
  filePath?: string;
  headerPreview: string;
  missingFields: string[];
  unknownLabels: { label: string; snippet: string }[];
  extracted: any;
  candidates?: any;
}) {
  try {
    const { admin, userId, petId, filePath, headerPreview, missingFields, unknownLabels, extracted, candidates } = params;
    await admin.from("extraction_debug_events").insert({
      user_id: userId,
      pet_id: petId || null,
      file_path: filePath || null,
      extractor_version: EXTRACTOR_VERSION,
      missing_fields: missingFields,
      header_preview: headerPreview,
      unknown_labels: unknownLabels,
      extracted,
      candidates: candidates || null,
    });
  } catch (error) {
    console.error("parse-clinical-summary: failed to log instrumentation", error);
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function guessMimeType(filePath: string, fallback?: string): string {
  if (fallback) return fallback;
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";

  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/cloud-platform" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

async function runDocumentAi(buffer: Uint8Array, mimeType: string): Promise<string | undefined> {
  const projectId = Deno.env.get("GOOGLE_PROJECT_ID");
  const serviceAccountJson = Deno.env.get("GOOGLE_SA_JSON");
  const processorId =
    Deno.env.get("GOOGLE_CLINICAL_PROCESSOR_ID") || Deno.env.get("GOOGLE_PROCESSOR_ID");
  const location =
    Deno.env.get("GOOGLE_CLINICAL_PROCESSOR_LOCATION") ||
    Deno.env.get("GOOGLE_PROCESSOR_LOCATION") ||
    "us";

  if (!projectId || !serviceAccountJson || !processorId) return undefined;

  const accessToken = await getAccessToken(serviceAccountJson);
  const endpoint = `https://documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;
  const content = toBase64(buffer);

  const aiRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rawDocument: {
        content,
        mimeType,
      },
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    throw new Error(`Document AI failed: ${errText}`);
  }

  const aiJson = await aiRes.json();
  const docText = aiJson?.document?.text;
  return typeof docText === "string" && docText.trim().length ? docText : undefined;
}


function findSection(text: string): string | undefined {
  let start = -1;
  for (const header of VITAL_HEADERS) {
    const idx = text.indexOf(header);
    if (idx !== -1 && (start === -1 || idx < start)) start = idx;
  }
  if (start === -1) return undefined;
  const afterStart = text.slice(start);
  let end = afterStart.length;
  for (const ender of SECTION_ENDERS) {
    const idx = afterStart.indexOf(ender);
    if (idx !== -1 && idx < end) end = idx;
  }
  return afterStart.slice(0, end);
}

function detectVendor(text: string): string {
  if (text.includes("CITYVET")) return "cityvet";
  return "generic";
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map(word => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function cleanDoctorName(raw: string): string {
  return raw
    .replace(/^DR\.?\s*/i, "")
    .replace(/\bDVM\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeBadName(name: string): boolean {
  const bad = ["GAVE", "PRESCRIBED", "PRINTED", "VACCINE", "MEDICATION", "THERAPEUTIC", "PROCEDURE"];
  const tokens = name.toUpperCase().split(/\s+/);
  return tokens.some(token => bad.includes(token));
}

function extractDoctor(text: string, sourceLabel: string) {
  const results: Candidate[] = [];
  const patterns: Array<[RegExp, number, string]> = [
    [/\bATTENDING\s+VET\(S\)\b\s*[:\-]?\s*(DR\.?\s*[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+){0,2})\b/g, 0.8, "attending vet(s)"],
    [/\bATTENDING\s+VETERINARIAN\b\s*[:\-]?\s*(DR\.?\s*[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+){0,3})\b/g, 0.8, "attending veterinarian"],
    [/\bPRESCRIBED\s+BY\b\s*[:\-]?\s*(DR\.?\s*[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+){0,2})\b/g, 0.6, "prescribed by"],
    [/\bPRINTED\s+BY\b\s*[:\-]?\s*(DR\.?\s*[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+){0,2})\b/g, 0.2, "printed by (weak)"],
  ];
  for (const [regex, confidence, reason] of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const cleaned = cleanDoctorName(match[1]);
      if (!cleaned || looksLikeBadName(cleaned)) continue;
      results.push({
        value: titleCase(cleaned),
        confidence,
        reason,
        source: sourceLabel,
      });
    }
  }
  return results;
}

function guessClinicFromHeader(header: string) {
  const results: Candidate[] = [];
  const lines = header.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const line of lines.slice(0, 10)) {
    if (/CLINICAL\s+SUMMARY/i.test(line)) break;
    if (/\b(Ph|Fax|Email)\b\s*[:\(]/i.test(line)) continue;
    if (/\bSUITE\b|\bFWY\b|\bST\b|\bAVE\b|\bRD\b|\bTX\b|\b\d{5}\b/i.test(line)) continue;
    if (line.length >= 3 && line.length <= 60) {
      results.push({
        value: line,
        confidence: 0.8,
        reason: "header first-line clinic heuristic",
        source: "header",
      });
      break;
    }
  }
  return results;
}

function extractClinic(text: string, sourceLabel: string) {
  const results: Candidate[] = [];
  const classic = /\b([A-Z0-9& ]{3,40})\s*(CLINIC|HOSPITAL|VETERINARY|ANIMAL HOSPITAL|ANIMAL CLINIC)\b/g;
  const brand = /\b(CITYVET\s*[-–—]\s*[A-Z][A-Z ]{2,40})\b/g;
  for (const [regex, confidence, reason] of [
    [brand, 0.6, "brand clinic (CITYVET - X)"],
    [classic, 0.6, "classic clinic suffix"],
  ] as Array<[RegExp, number, string]>) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      results.push({
        value: titleCase(match[1].trim()),
        confidence,
        reason,
        source: sourceLabel,
      });
    }
  }
  return results;
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(",", ".");
  const cleaned = normalized.replace(/[^0-9.]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreConfidence(base: number, boost: number, penalty: number): number {
  return clamp(base + boost - penalty, 0, 1);
}

function extractWeight(text: string, inSection: boolean) {
  const results = [];
  const regex = /\b(?:WEIGHT|WT|BW|BODY WEIGHT)\b[^0-9]{0,10}([0-9]{1,3}(?:[.,][0-9]+)?)\s*(LB|LBS|#|KG)?/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const rawValue = match[1];
    const unit = match[2] || "";
    let value = parseNumber(rawValue);
    if (value === undefined) continue;
    const unitUpper = unit.toUpperCase();
    let normalizedUnit = unitUpper || "LB";
    if (unitUpper === "KG") {
      value = value * 2.20462;
      normalizedUnit = "LB";
    }
    const inRange = isPlausibleWeightLb(value);
    if (!inRange) continue;
    const base = inSection ? 0.75 : 0.55;
    const boost = unitUpper ? 0.1 : 0;
    const penalty = 0;
    results.push({
      value: Number(value.toFixed(2)),
      unit: normalizedUnit,
      confidence: scoreConfidence(base, boost, penalty),
      source: inSection ? "vitals_block" : "document",
    });
  }
  return results;
}

function extractHeartRate(text: string, sourceLabel: string, inSection: boolean) {
  const results: Candidate[] = [];
  const t = joinSplitDigits(text);
  const patterns = [
    /\bH(?:\.|\s)*R(?:\.|\s)*[:\-]?\s*(\d{2,3})\b/g,
    /\bHEART\s*RATE\b[:\-]?\s*(\d{2,3})\b/g,
    /\bPULSE\b[:\-]?\s*(\d{2,3})\b/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(t)) !== null) {
      const value = toInt(match[1]);
      if (value == null || !isPlausibleHeartRate(value)) continue;
      results.push({
        value,
        confidence: inSection ? 0.9 : 0.4,
        reason: inSection ? "HR in Health Status section" : "HR label match",
        source: sourceLabel,
      });
    }
  }
  return results;
}

function extractRespiratoryRate(text: string, sourceLabel: string, inSection: boolean) {
  const results: Candidate[] = [];
  const t = joinSplitDigits(text);
  const patterns = [
    /\bR(?:\.|\s)*R(?:\.|\s)*[:\-]?\s*(\d{1,2})\b/g,
    /\bRESP(?:IRATORY)?\s*RATE\b[:\-]?\s*(\d{1,2})\b/g,
    /\bRESPIRATION\b[:\-]?\s*(\d{1,2})\b/g,
  ];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(t)) !== null) {
      const value = toInt(match[1]);
      if (value == null || !isPlausibleRespRate(value)) continue;
      results.push({
        value,
        confidence: inSection ? 0.9 : 0.4,
        reason: inSection ? "RR in Health Status section" : "RR label match",
        source: sourceLabel,
      });
    }
  }
  return results;
}

function extractAttitude(text: string, inSection: boolean) {
  const results = [];
  const regex = /\b(?:ATTITUDE|MENTATION|ATT)\b[^A-Z]{0,10}([A-Z ]{2,30})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1].trim();
    let code: string | undefined;
    if (/\bBAR\b/.test(raw) || (raw.includes("BRIGHT") && raw.includes("ALERT") && raw.includes("RESPONSIVE"))) code = "BAR";
    else if (/\bQAR\b/.test(raw) || (raw.includes("QUIET") && raw.includes("ALERT") && raw.includes("RESPONSIVE"))) code = "QAR";
    else if (/\bL\b/.test(raw) || raw.includes("LETHARGIC")) code = "L";
    else if (/\bD\b/.test(raw) || raw.includes("DEPRESSED")) code = "D";
    if (!code) continue;
    const base = inSection ? 0.75 : 0.55;
    results.push({
      value: code,
      confidence: scoreConfidence(base, 0.1, 0),
      source: inSection ? "vitals_block" : "document",
    });
  }

  if (results.length === 0) {
    const inlineRegex = /\b(BAR|QAR|LETHARGIC|DEPRESSED)\b/g;
    let inline;
    while ((inline = inlineRegex.exec(text)) !== null) {
      const raw = inline[1];
      const code = raw === "LETHARGIC" ? "L" : raw === "DEPRESSED" ? "D" : raw;
      results.push({
        value: code,
        confidence: scoreConfidence(inSection ? 0.6 : 0.45, 0.05, 0),
        source: inSection ? "vitals_block" : "document",
      });
    }
  }
  return results;
}

function extractVisitDate(text: string, sourceLabel: string) {
  const results: Candidate[] = [];
  const DATE = "(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})";
  const patterns: Array<[RegExp, number, string]> = [
    [new RegExp(`\\bRECORD\\s+DATE\\b\\s*[:\\-]?\\s*${DATE}`, "g"), 0.8, "record date"],
    [new RegExp(`\\b(?:VISIT|APPT|APPOINTMENT)\\s+DATE\\b\\s*[:\\-]?\\s*${DATE}`, "g"), 0.6, "visit/appt date"],
    [new RegExp(`\\bPRINTED\\s+AT\\b\\s*[:\\-]?\\s*${DATE}`, "g"), 0.2, "printed at (weak)"],
    [new RegExp(`\\bPRINTED\\b\\s*[:\\-]?\\s*${DATE}`, "g"), 0.2, "printed (weak)"],
    [new RegExp(`\\bPRINTED\\s*[-–—]\\s*${DATE}`, "g"), 0.2, "printed - (weak)"],
  ];
  for (const [regex, confidence, reason] of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[1];
      const parts = raw.split(/[\/\-]/);
      const month = parts[0]?.padStart(2, "0");
      const day = parts[1]?.padStart(2, "0");
      const year = parts[2]?.length === 2 ? `20${parts[2]}` : parts[2];
      const normalized = month && day && year ? `${year}-${month}-${day}` : raw;
      results.push({
        value: normalized,
        confidence,
        reason,
        source: sourceLabel,
      });
    }
  }
  return results;
}

function extractVisitType(text: string, inSection: boolean) {
  const mappings: { key: string; value: string }[] = [
    { key: "ROUTINE", value: "routine" },
    { key: "CHECKUP", value: "routine" },
    { key: "WELLNESS", value: "routine" },
    { key: "VACCINATION", value: "vaccination" },
    { key: "VACCINE", value: "vaccination" },
    { key: "SICK", value: "sick" },
    { key: "FOLLOW-UP", value: "followup" },
    { key: "FOLLOW UP", value: "followup" },
    { key: "EMERGENCY", value: "emergency" },
  ];
  for (const mapping of mappings) {
    if (text.includes(mapping.key)) {
      return {
        value: mapping.value,
        confidence: scoreConfidence(inSection ? 0.6 : 0.4, 0.05, 0),
        source: inSection ? "vitals_block" : "document",
      };
    }
  }
  return undefined;
}

function pickBest(candidates: any[]): any | undefined {
  if (!candidates || candidates.length === 0) return undefined;
  return candidates.sort((a, b) => b.confidence - a.confidence)[0];
}

async function extractTextFromPdf(buffer: Uint8Array): Promise<string> {
  const workerSrc = ensureWorkerSrc();
  console.log("parse-clinical-summary: workerSrc", workerSrc ? "set" : "missing");
  const loadingTask = pdfjsLib.getDocument({ data: buffer, disableWorker: true });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str || "").join(" ");
    fullText += `\n${pageText}`;
  }
  return fullText;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader =
      req.headers.get("Authorization") ||
      req.headers.get("authorization") ||
      "";
    let resolvedUserId: string | null = null;
    if (authHeader) {
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      const userClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      if (!userError && userData?.user) {
        resolvedUserId = userData.user.id;
      }
    }

    const body = await req.json();
    const filePath = body?.filePath as string | undefined;
    const rawTextInput = body?.rawText as string | undefined;
    const petId = body?.petId as string | undefined;
    if (!filePath && !rawTextInput) {
      return new Response(JSON.stringify({ error: "Missing filePath or rawText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resolvedUserId && filePath && !filePath.startsWith(`${resolvedUserId}/`)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    let rawText = rawTextInput || "";
    let buffer: Uint8Array | null = null;
    const mimeType = filePath ? guessMimeType(filePath, body?.mimeType) : "application/pdf";
    if (!rawText && filePath) {
      const { data: fileBlob, error: fileError } = await admin.storage
        .from("health-documents")
        .download(filePath);

      if (fileError || !fileBlob) {
        throw new Error(`Failed to download summary: ${fileError?.message}`);
      }

      buffer = new Uint8Array(await fileBlob.arrayBuffer());
      try {
        const docAiText = await runDocumentAi(buffer, mimeType);
        if (docAiText) {
          rawText = docAiText;
        }
      } catch (error) {
        console.error("parse-clinical-summary: Document AI failed", error);
      }

      if (!rawText) {
        if (mimeType === "application/pdf") {
          rawText = await extractTextFromPdf(buffer);
        } else {
          rawText = "";
        }
      }
    }
    const textLength = rawText.trim().length;
    const usedOcr = false;
    if (textLength < 80) {
      const payload = {
        needsOcr: true,
        vendor: "unknown",
        textLength,
      };
      console.log("parse-clinical-summary response", payload);
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizeText(rawText);
    const header = extractHeaderBlock(normalized);
    const healthSection = extractHealthStatusSection(normalized) || findSection(normalized) || "";
    const vendor = detectVendor(normalized);
    const sectionText = healthSection || normalized;

    const weight = pickBestStrict([
      ...extractWeight(sectionText, true),
      ...extractWeight(normalized, false),
    ]);
    const heartRate = pickBestStrict([
      ...(healthSection ? extractHeartRate(healthSection, "healthstatus", true) : []),
      ...extractHeartRate(normalized, "fulltext", false),
    ]);
    const respiratoryRate = pickBestStrict([
      ...(healthSection ? extractRespiratoryRate(healthSection, "healthstatus", true) : []),
      ...extractRespiratoryRate(normalized, "fulltext", false),
    ]);
    const attitude = pickBestStrict([
      ...extractAttitude(sectionText, true),
      ...extractAttitude(normalized, false),
    ]);
    const visitDate = pickBestStrict([
      ...extractVisitDate(header, "header"),
      ...extractVisitDate(normalized, "fulltext"),
    ]);
    const visitType = extractVisitType(normalized, !!healthSection);
    const doctorName = pickBestStrict([
      ...extractDoctor(header, "header"),
      ...extractDoctor(normalized, "fulltext"),
    ]);
    const clinicName = pickBestStrict([
      ...guessClinicFromHeader(header),
      ...extractClinic(header, "header"),
      ...extractClinic(normalized, "fulltext"),
    ]);

    const payload = {
      vendor,
      usedOcr,
      textLength,
      normalized: {
        weight,
        heartRate,
        respiratoryRate,
        attitude,
        visitDate,
        visitType,
        doctorName,
        clinicName,
      },
    };
    const missingFields = getMissingFields(payload.normalized);
    const headerPreview = buildHeaderPreview(header);
    const unknownLabels = findUnknownLabels(normalized);
    await logExtractionDebug({
      admin,
      userId: resolvedUserId,
      petId,
      filePath,
      headerPreview,
      missingFields,
      unknownLabels,
      extracted: payload.normalized,
    });
    console.log("parse-clinical-summary response", payload);
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("parse-clinical-summary error", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

