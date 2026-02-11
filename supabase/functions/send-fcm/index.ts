// @ts-nocheck
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(serviceAccountJson: string): Promise<{ token: string; projectId: string }> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const projectId = sa.project_id;

  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
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
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to obtain access token: ${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.access_token, projectId };
}

async function sendToToken(accessToken: string, projectId: string, payload: any) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: payload }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error?.message || "Unknown error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!supabaseUrl || !serviceRoleKey || !serviceAccountJson) {
      return new Response(JSON.stringify({ error: "Missing required environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { notification, data } = body as any;
    let tokens: string[] = Array.isArray((body as any).tokens) ? (body as any).tokens : [];

    if (!tokens.length) {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace("Bearer ", "").trim();
      if (!jwt) {
        return new Response(JSON.stringify({ error: "Missing Authorization header or tokens[]" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: userError?.message || "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tokenRows, error: tokenError } = await supabaseAdmin
        .from("push_tokens")
        .select("expo_push_token")
        .eq("owner_id", userData.user.id)
        .not("expo_push_token", "is", null);
      if (tokenError) {
        return new Response(JSON.stringify({ error: tokenError.message || "Token lookup failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      tokens = (tokenRows || [])
        .map((row) => row.expo_push_token)
        .filter((token) => !!token);
    }

    if (!tokens.length) {
      return new Response(JSON.stringify({ ok: true, results: [], skipped: "no_tokens" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { token: accessToken, projectId } = await getAccessToken(serviceAccountJson);
    const results = await Promise.all(
      tokens.map(async (token: string) => {
        const result = await sendToToken(accessToken, projectId, {
          token,
          notification,
          data,
        });
        if (!result.ok && typeof result.error === "string") {
          const upper = result.error.toUpperCase();
          if (upper.includes("UNREGISTERED")) {
            await supabaseAdmin.from("push_tokens").delete().eq("expo_push_token", token);
          }
        }
        return { token, ...result };
      })
    );

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

