import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  console.log("Requesting OTP for:", phone);

  const apiKey = Deno.env.get("BRIQ_API_KEY");
  const developerAppId = Deno.env.get("BRIQ_DEVELOPER_APP_ID");

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
    console.log("Calling Briq OTP API");
    const response = await fetch("https://karibu.briq.tz/v1/otp/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        phone_number: phone,
        app_key: developerAppId,
        otp_length: 6,
        minutes_to_expire: 10,
        delivery_method: "sms",
        message_template: "Your AfriLink verification code is {code}. It expires in 10 minutes.",
      }),
    });

    const data = await response.json();
    console.log("Briq API response status:", response.status);

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
      request_id: data.request_id 
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
