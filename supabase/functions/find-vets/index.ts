// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL_NAME = "gemini-2.5-flash";

async function callGemini(geminiApiKey: string, prompt: string, useGrounding: boolean) {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: 4096,
  };
  // Tool use (grounding) cannot be combined with responseMimeType: "application/json"
  if (!useGrounding) {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (useGrounding) {
    body.tools = [{ google_search: {} }];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function normalizeWebsite(url: string): string {
  const u = (url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return "https://" + u.replace(/^\/+/, "");
}

function parseVetsFromResponse(data: any): { name: string; address: string; website: string; phone: string }[] {
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!rawText) return [];

  let jsonStr = rawText;
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```$/;
  const match = rawText.match(codeBlock);
  if (match) jsonStr = match[1].trim();

  try {
    const vets = JSON.parse(jsonStr);
    if (!Array.isArray(vets)) return [];
    return vets.map((v: any) => ({
      name: String(v?.name ?? "").trim(),
      address: String(v?.address ?? "").trim(),
      website: normalizeWebsite(String(v?.website ?? "")),
      phone: String(v?.phone ?? "").trim(),
    }));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const zipCode = String(body?.zipCode || "").trim();
    const radiusMiles = Math.min(50, Math.max(1, Number(body?.radiusMiles) || 10));
    const limit = Math.min(20, Math.max(5, Number(body?.limit) || 8));

    if (!zipCode) {
      return new Response(
        JSON.stringify({ error: "Missing zipCode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const countPhrase = limit <= 8
      ? `Quickly find the top ${limit} veterinary clinics`
      : `Find ${limit} to ${Math.min(limit + 3, 20)} veterinary clinics`;
    const prompt = `${countPhrase} and animal hospitals in or near ZIP code ${zipCode} (within ${radiusMiles} miles). Prioritize well-known clinics and chains (CityVet, VCA, Banfield, local practices) that serve this area. For each clinic provide: name, full street address (street, city, state, ZIP), full website URL starting with https://, and phone number. Return ONLY a valid JSON array of objects. Each object: "name", "address", "website", "phone". Use "" only if website or phone not found. Every website must be a full https URL. No markdown, no code fences - only the JSON array.`;

    // Try with Google Search grounding first
    let result = await callGemini(geminiApiKey, prompt, true);

    if (!result.ok) {
      console.warn("find-vets: Grounding request failed, retrying without grounding:", result.status, result.data?.error?.message);
      result = await callGemini(geminiApiKey, prompt, false);
    }

    if (!result.ok) {
      const errMsg = result.data?.error?.message || result.data?.error || "Gemini request failed";
      console.error("find-vets: Gemini error", result.status, errMsg);
      return new Response(
        JSON.stringify({ error: "Search failed", details: String(errMsg) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vets = parseVetsFromResponse(result.data);
    return new Response(
      JSON.stringify({ vets }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("find-vets error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
