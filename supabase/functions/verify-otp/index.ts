import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpPayload {
  phone?: string;
  code?: string;
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

  let payload: VerifyOtpPayload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("Failed to parse verify OTP payload", error);
    return new Response(JSON.stringify({ success: false, error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { phone, code } = payload;
  if (!phone || !code) {
    return new Response(JSON.stringify({ success: false, error: "Phone and code are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  console.log("Verifying OTP for:", phone);

  const apiKey = Deno.env.get("BRIQ_API_KEY");
  const developerAppId = Deno.env.get("BRIQ_DEVELOPER_APP_ID");

  if (!apiKey || !developerAppId) {
    console.error("Briq API configuration missing");
    return new Response(
      JSON.stringify({ success: false, error: "SMS provider not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  try {
    console.log("Calling Briq OTP verify API");
    const response = await fetch("https://karibu.briq.tz/v1/otp/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        phone_number: phone,
        developer_app_id: developerAppId,
        code: code,
      }),
    });

    const data = await response.json();
    console.log("Briq verify response status:", response.status);

    if (!response.ok || !data.verified) {
      console.error("OTP verification failed", { status: response.status, data });
      return new Response(JSON.stringify({ 
        success: false, 
        error: data.message || "Invalid or expired code" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("OTP verified successfully for:", phone);
    return new Response(JSON.stringify({ success: true, verified: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Briq verify API exception", error);
    return new Response(JSON.stringify({ success: false, error: "Verification failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
