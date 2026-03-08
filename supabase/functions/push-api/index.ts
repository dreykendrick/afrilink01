import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// --- VAPID key helpers using Web Crypto (P-256 / ECDSA) ---

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const rawPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const pkcs8Private = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return {
    publicKey: base64UrlEncode(rawPublic),
    privateKey: base64UrlEncode(pkcs8Private),
  };
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getAuthClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

// Get or create VAPID keys
async function getVapidPublicKey(): Promise<string> {
  const admin = getServiceClient();
  const { data } = await admin
    .from("push_config")
    .select("value")
    .eq("key", "vapid_public_key")
    .maybeSingle();

  if (data?.value) return data.value;

  // Generate new key pair
  const keys = await generateVapidKeys();
  await admin.from("push_config").upsert([
    { key: "vapid_public_key", value: keys.publicKey },
    { key: "vapid_private_key", value: keys.privateKey },
  ]);
  console.log("[push-api] Generated new VAPID key pair");
  return keys.publicKey;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    // --- GET /vapid-key  (public, no auth needed) ---
    if (req.method === "GET" && path === "vapid-key") {
      const publicKey = await getVapidPublicKey();
      return json({ publicKey });
    }

    // --- All other routes require auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = getAuthClient(authHeader);
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // --- POST /subscribe ---
    if (req.method === "POST" && path === "subscribe") {
      const body = await req.json();
      const { endpoint, p256dh, auth, platform } = body;

      if (!endpoint || !p256dh || !auth) {
        return json({ error: "Missing subscription fields" }, 400);
      }

      // Upsert subscription (on conflict user_id+endpoint)
      const { error } = await userClient
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            platform: platform || "web",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" }
        );

      if (error) {
        console.error("[push-api] subscribe error:", error);
        return json({ error: "Failed to store subscription" }, 500);
      }

      return json({ success: true });
    }

    // --- DELETE /subscribe ---
    if (req.method === "DELETE" && path === "subscribe") {
      const body = await req.json();
      const { endpoint } = body;

      if (!endpoint) return json({ error: "Missing endpoint" }, 400);

      await userClient
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

      return json({ success: true });
    }

    // --- POST /send  (internal: used by other edge functions via service role) ---
    if (req.method === "POST" && path === "send") {
      // This endpoint is for server-to-server calls
      // For now, we'll implement sending when the web-push Deno module is available
      // The actual sending will be done by the backend/checkout system
      return json({
        success: true,
        message: "Push sending is handled by the backend system",
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("[push-api] Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
