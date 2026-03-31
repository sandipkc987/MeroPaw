// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL_NAME = "gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY missing");

    const body = await req.json();
    const { imageBase64, petName, mimeType = "image/jpeg" } = body;
    if (!imageBase64) throw new Error("Missing imageBase64");

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const prompt = `The pet is named ${petName || 'this pet'}. Write a 5-10 word heartwarming caption. Response text only.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: cleanBase64 } }
            ]
          }]
        })
      }
    );

    const data = await response.json();

    // TOKEN COUNTER LOGIC
    if (data.usageMetadata) {
      const { promptTokenCount, candidatesTokenCount, totalTokenCount } = data.usageMetadata;
      console.log(`[TOKEN USAGE] Input: ${promptTokenCount} | Output: ${candidatesTokenCount} | Total: ${totalTokenCount}`);
      
      // Estimated cost calculation based on 2026 Flash rates ($0.30/1M input)
      const costEstimate = (promptTokenCount * 0.0000003) + (candidatesTokenCount * 0.0000025);
      console.log(`[COST ESTIMATE] $${costEstimate.toFixed(6)}`);
    }

    const caption = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!caption) throw new Error("No caption generated");

    return new Response(JSON.stringify({ caption }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
