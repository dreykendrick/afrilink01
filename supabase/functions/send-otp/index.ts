import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NOTE: Temporary debug helpers (safe logging, no secrets/OTP values).
const SENSITIVE_KEYS = new Set([
  "api_key",
  "apikey",
  "app_key",
  "token",
  "secret",
  "code",
  "otp",
  "otp_code",
]);

function redactForLogs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForLogs);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) out[k] = "[REDACTED]";
      else out[k] = redactForLogs(v);
    }
    return out;
  }
  return value;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface OtpPayload {
  phone?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let payload: OtpPayload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("Failed to parse OTP payload", error);
    return new Response(JSON.stringify({ success: false, error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { phone } = payload;
  if (!phone) {
    return new Response(JSON.stringify({ success: false, error: "Phone number is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // STEP 1 (trace): log exactly what the backend receives from the frontend.
  const phoneNoPlus = phone.startsWith("+") ? phone.slice(1) : phone;
  const phone255NoPlus = phoneNoPlus.startsWith("255") ? phoneNoPlus : phoneNoPlus;
  console.log("[send-otp] Incoming OTP request", {
    phone_original: phone,
    phone_candidate_no_plus: phoneNoPlus,
    phone_candidate_255_no_plus: phone255NoPlus,
  });

  const apiKey = Deno.env.get("BRIQ_API_KEY");
  const developerAppId = Deno.env.get("BRIQ_DEVELOPER_APP_ID");

  // STEP 5 (env verification): log presence only (no values).
  console.log("[send-otp] Briq env vars present?", {
    BRIQ_API_KEY: Boolean(apiKey),
    BRIQ_DEVELOPER_APP_ID: Boolean(developerAppId),
  });

  if (!apiKey || !developerAppId) {
    console.error("Briq API configuration missing", { 
      apiKeyConfigured: Boolean(apiKey),
      developerAppIdConfigured: Boolean(developerAppId)
    });
    return new Response(
      JSON.stringify({ success: false, error: "SMS provider not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  try {
    const briqEndpointUrl = "https://karibu.briq.tz/v1/otp/request";
    console.log("[send-otp] Calling Briq OTP API", { endpoint: briqEndpointUrl });

    // STEP 2 (request payload capture): build payload explicitly so we can safely log it.
    const briqPayload = {
      phone_number: phone,
      // Briq currently requires `app_key` (we observed 422 when missing).
      // Keep `developer_app_id` alongside for compatibility with any updated docs.
      app_key: developerAppId,
      developer_app_id: developerAppId,
      sender_id: "Afrilink",
      otp_length: 6,
      minutes_to_expire: 10,
      delivery_method: "sms",
      message_template: "Your AfriLink verification code is {code}. It expires in 10 minutes.",
    };

    console.log(
      "[send-otp] Briq request payload (sanitized)",
      JSON.stringify(redactForLogs(briqPayload)),
    );

    const response = await fetch(briqEndpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(briqPayload),
    });

    const responseText = await response.text();
    const parsed = safeJsonParse(responseText);

    // STEP 3 (response capture): status + full response body (sanitized), plus any ids.
    console.log("[send-otp] Briq API response status:", response.status);
    console.log(
      "[send-otp] Briq API response body (sanitized):",
      parsed ? JSON.stringify(redactForLogs(parsed)) : responseText,
    );

    const data = (parsed ?? {}) as Record<string, unknown>;
    const requestId = (data["request_id"] ?? data["requestId"] ?? null) as string | null;
    const messageId = (data["message_id"] ?? data["messageId"] ?? null) as string | null;
    const queueStatus = (data["queue_status"] ?? data["queueStatus"] ?? null) as string | null;
    console.log("[send-otp] Briq parsed identifiers", {
      request_id: requestId,
      message_id: messageId,
      queue_status: queueStatus,
    });

    if (!response.ok) {
      console.error("Briq API failed", { status: response.status, data });
      return new Response(JSON.stringify({ success: false, error: "SMS delivery failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("OTP request sent successfully for:", phone);
    return new Response(JSON.stringify({ 
      success: true,
      request_id: requestId,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Briq API exception", error);
    return new Response(JSON.stringify({ success: false, error: "SMS delivery failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
