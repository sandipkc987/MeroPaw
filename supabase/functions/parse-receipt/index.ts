// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function getEntity(document: any, type: string): string | undefined {
  const entities = document?.entities || [];
  const match = entities.find((e: any) => e.type === type);
  if (!match) return undefined;
  return match?.normalizedValue?.text || match?.mentionText || undefined;
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9.]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const projectId = Deno.env.get("GOOGLE_PROJECT_ID")!;
    const processorId = Deno.env.get("GOOGLE_PROCESSOR_ID")!;
    const location = Deno.env.get("GOOGLE_PROCESSOR_LOCATION") || "us";
    const serviceAccountJson = Deno.env.get("GOOGLE_SA_JSON")!;

    const authHeader =
      req.headers.get("Authorization") ||
      req.headers.get("authorization") ||
      "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const filePath = body?.filePath as string;
    const documentId = body?.documentId as string | undefined;
    const petId = body?.petId as string | undefined;
    const saveExpense = body?.saveExpense !== false;
    const mimeType = guessMimeType(filePath, body?.mimeType);

    if (!filePath) {
      return new Response(JSON.stringify({ error: "Missing filePath" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!filePath.startsWith(`${userData.user.id}/`)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Prefer inline content from client (fixes iOS where storage upload can yield empty file)
    let content: string;
    const contentBase64 = body?.contentBase64;
    if (typeof contentBase64 === "string" && contentBase64.length > 0) {
      content = contentBase64.replace(/^data:[^;]+;base64,/, "");
    } else {
      const { data: fileBlob, error: fileError } = await admin.storage
        .from("receipts")
        .download(filePath);

      if (fileError || !fileBlob) {
        throw new Error(`Failed to download receipt: ${fileError?.message}`);
      }

      const buffer = new Uint8Array(await fileBlob.arrayBuffer());
      content = toBase64(buffer);
    }

    if (!content || content.length === 0) {
      return new Response(
        JSON.stringify({ error: "Receipt content is empty. Try uploading the file again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getAccessToken(serviceAccountJson);
    const endpoint = `https://documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

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
    const doc = aiJson?.document;

    const merchant = getEntity(doc, "supplier_name");
    const totalText = getEntity(doc, "total_amount");
    const currency = getEntity(doc, "currency") || doc?.currencyCode;
    const date = getEntity(doc, "purchase_date");
    const total = parseNumber(totalText);

    let resolvedDocumentId = documentId;
    if (!resolvedDocumentId) {
      const { data: insertedDoc, error: insertError } = await admin
        .from("documents")
        .insert({
          user_id: userData.user.id,
          pet_id: petId || null,
          file_path: filePath,
          status: "processing",
        })
        .select()
        .single();

      if (insertError || !insertedDoc) {
        throw new Error(`Document insert failed: ${insertError?.message}`);
      }
      resolvedDocumentId = insertedDoc.id;
    }

    await admin.from("expense_extractions").insert({
      document_id: resolvedDocumentId,
      raw_json: aiJson,
    });

    let expenseRow: any = null;
    if (saveExpense) {
      const { data: insertedExpense } = await admin
      .from("expenses")
      .insert({
        document_id: resolvedDocumentId,
        user_id: userData.user.id,
          pet_id: petId || null,
          title: merchant || null,
          amount: total ?? null,
        merchant: merchant || null,
        total: total ?? null,
        currency: currency || null,
        date: date || null,
        category: null,
          receipt_path: filePath,
          receipt_type: mimeType.includes("pdf") ? "pdf" : "image",
      })
      .select()
      .single();
      expenseRow = insertedExpense;
    }

    await admin.from("documents").update({ status: "processed" }).eq("id", resolvedDocumentId);

    const totalLabel = total !== undefined && total !== null
      ? `${Number(total).toFixed(2)}${currency ? ` ${currency}` : ""}`
      : "a receipt";
    const merchantLabel = merchant ? ` from ${merchant}` : "";
    await admin.from("notifications").insert({
      owner_id: userData.user.id,
      pet_id: petId || null,
      kind: "expense",
      title: "Receipt processed",
      message: `We processed ${totalLabel}${merchantLabel}.`,
      cta_label: "View receipt",
      metadata: {
        type: "receipt_processed",
        expenseId: expenseRow?.id,
        documentId: resolvedDocumentId,
        merchant,
        total,
        currency,
      },
    });

    return new Response(
      JSON.stringify({
        documentId: resolvedDocumentId,
        expenseId: expenseRow?.id,
        receiptPath: filePath,
        normalized: {
          merchant,
          total,
          currency,
          date,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("parse-receipt error", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

