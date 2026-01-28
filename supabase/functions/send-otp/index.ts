import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OtpPayload {
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

  const { phone, code } = payload;
  if (!phone || !code) {
    return new Response(JSON.stringify({ success: false, error: "Phone and code are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  console.log("Sending OTP to:", phone);

  const apiUrl = Deno.env.get("SMS_API_URL");
  const apiKey = Deno.env.get("SMS_API_KEY");
  const senderId = Deno.env.get("SMS_SENDER_ID") ?? "AfriLink";

  if (!apiUrl || !apiKey) {
    console.error("SMS provider configuration missing", { apiUrlConfigured: Boolean(apiUrl) });
    return new Response(
      JSON.stringify({ success: false, error: "SMS provider not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }

  const message = `Your AfriLink verification code is ${code}. It expires in 10 minutes.`;

  try {
    console.log("Calling SMS API:", apiUrl);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: phone,
        message,
        sender: senderId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SMS provider failed", { status: response.status, errorText });
      return new Response(JSON.stringify({ success: false, error: "SMS delivery failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("OTP sent successfully to:", phone);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("SMS send exception", error);
    return new Response(JSON.stringify({ success: false, error: "SMS delivery failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
