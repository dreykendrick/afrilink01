// @ts-nocheck
// Proxy edge function that bridges the AfriLink main app to the external
// Order Service hosted at order-guardian.vercel.app. Keeps the API key
// server-side and resolves the logged-in user's vendor_code automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORDER_GUARDIAN_API_KEY = Deno.env.get("ORDER_GUARDIAN_API_KEY") ?? "";
const ORDER_GUARDIAN_BASE_URL =
  (Deno.env.get("ORDER_GUARDIAN_BASE_URL") ?? "https://order-guardian.vercel.app").replace(/\/+$/, "");

const WITHDRAWAL_FEE_TZS = 2000;

async function callOrderService(path: string, init: RequestInit = {}) {
  const url = `${ORDER_GUARDIAN_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers ?? {});
  if (ORDER_GUARDIAN_API_KEY) {
    headers.set("Authorization", `Bearer ${ORDER_GUARDIAN_API_KEY}`);
    headers.set("x-api-key", ORDER_GUARDIAN_API_KEY);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve vendor_code for the logged-in user
    const { data: vendorProfile } = await admin
      .from("vendor_profiles")
      .select("vendor_code, business_name")
      .eq("user_id", userId)
      .maybeSingle();

    const vendorCode = (vendorProfile as any)?.vendor_code as string | null;

    const url = new URL(req.url);
    // Path after the function name, e.g. /order-guardian/orders -> /orders
    const rawPath = url.pathname.replace(/^\/order-guardian/, "") || "/";
    const path = rawPath.replace(/\/+$/, "") || "/";

    if (!ORDER_GUARDIAN_API_KEY) {
      return json({ error: "Order service not configured" }, 503);
    }

    // GET /orders
    if (req.method === "GET" && path === "/orders") {
      if (!vendorCode) {
        return json({ error: "Vendor code not set for this account", orders: [] }, 200);
      }
      const { ok, status, body } = await callOrderService(
        `/orders?vendor_id=${encodeURIComponent(vendorCode)}`,
      );
      return json(ok ? body : { error: "Upstream error", details: body }, ok ? 200 : status);
    }

    // GET /wallet
    if (req.method === "GET" && path === "/wallet") {
      if (!vendorCode) {
        return json(
          {
            error: "Vendor code not set for this account",
            wallet: { balance: 0, currency: "TZS" },
          },
          200,
        );
      }
      const { ok, status, body } = await callOrderService(
        `/wallet/${encodeURIComponent(vendorCode)}`,
      );
      return json(ok ? body : { error: "Upstream error", details: body }, ok ? 200 : status);
    }

    // POST /withdrawals
    if (req.method === "POST" && path === "/withdrawals") {
      if (!vendorCode) {
        return json({ error: "Vendor code not set for this account" }, 400);
      }
      let payload: any = {};
      try {
        payload = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const amount = Number(payload?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return json({ error: "Invalid amount" }, 400);
      }
      if (amount <= WITHDRAWAL_FEE_TZS) {
        return json(
          { error: `Amount must exceed the ${WITHDRAWAL_FEE_TZS} TZS fee` },
          400,
        );
      }

      const destinationType = String(payload?.destination_type ?? "MOBILE_MONEY");
      const destinationDetails = payload?.destination_details ?? {};
      const netAmount = amount - WITHDRAWAL_FEE_TZS;

      // 1) Send to external order service
      const upstream = await callOrderService(`/withdrawals`, {
        method: "POST",
        body: JSON.stringify({
          vendor_id: vendorCode,
          amount,
          fee: WITHDRAWAL_FEE_TZS,
          net_amount: netAmount,
          destination_type: destinationType,
          destination_details: destinationDetails,
        }),
      });

      if (!upstream.ok) {
        return json(
          { error: "Order service rejected withdrawal", details: upstream.body },
          upstream.status,
        );
      }

      // 2) Mirror to Supabase payout_requests so existing admin approval UI works
      let walletId: string | null = null;
      try {
        const { data: walletIdData } = await admin.rpc("get_or_create_wallet", {
          p_owner_type: "VENDOR",
          p_owner_id: userId,
          p_currency: "TZS",
        });
        walletId = walletIdData as string;
      } catch (e) {
        console.warn("[order-guardian] wallet lookup failed", e);
      }

      if (walletId) {
        const { error: prErr } = await admin.from("payout_requests").insert({
          user_id: userId,
          wallet_id: walletId,
          amount: Math.round(amount),
          destination_type: destinationType,
          destination_details: {
            ...destinationDetails,
            external_provider: "order-guardian",
            external_response: upstream.body,
            fee_tzs: WITHDRAWAL_FEE_TZS,
            net_amount_tzs: netAmount,
            vendor_code: vendorCode,
          },
          status: "REQUESTED",
        });
        if (prErr) {
          console.error("[order-guardian] mirror payout_requests failed", prErr);
        }
      }

      return json({
        success: true,
        amount,
        fee: WITHDRAWAL_FEE_TZS,
        net_amount: netAmount,
        upstream: upstream.body,
      });
    }

    return json({ error: "Not found", path }, 404);
  } catch (err) {
    console.error("[order-guardian] error", err);
    return json({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
});
