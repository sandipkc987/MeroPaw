// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL_NAME = "gemini-2.5-flash";
const MAX_TEXT_LENGTH = 1500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY missing");

    const body = await req.json();
    const rawText = (body?.rawText as string) || "";
    const petName = (body?.petName as string) || "your pet";
    if (!rawText || rawText.trim().length < 50) {
      throw new Error("Missing or too short rawText (min 50 chars)");
    }

    const truncated = rawText.trim().slice(0, MAX_TEXT_LENGTH);
    const prompt = `Summarize this veterinary clinical summary in 1-2 short sentences. Start with "${petName} had" (e.g. "${petName} had their annual check-up..."). Use plain language. Include: visit type, main findings, and any next steps if mentioned. Response text only, no JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${prompt}\n\n---\n\n${truncated}` }],
          }],
        }),
      }
    );

    const data = await response.json();

    if (data?.usageMetadata) {
      const { promptTokenCount, candidatesTokenCount } = data.usageMetadata;
      console.log(`[generate-health-summary] Tokens: in=${promptTokenCount} out=${candidatesTokenCount}`);
    }

    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!summary) throw new Error("No summary generated");

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-health-summary error:", error?.message);
    return new Response(
      JSON.stringify({ error: String(error?.message || error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
