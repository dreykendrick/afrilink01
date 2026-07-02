// @ts-nocheck
/**
 * Unified /checkout/create endpoint
 * Combines order creation (checkout-api/orders) + payment creation (payments-api/create-payment)
 * into a single call for the external shop app (shop.afrilink.info).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRIQ_BASE_URL = (Deno.env.get('BRIQ_BASE_URL') || 'https://paygrid.briq.tz').replace(/\/$/, '');
const BRIQ_API_KEY = Deno.env.get('BRIQ_API_KEY') || '';
const BRIQ_DEVELOPER_APP_ID = Deno.env.get('BRIQ_DEVELOPER_APP_ID') || '';

async function briqCreatePayment(params: {
  amount: number; currency: string; orderId: string;
  idempotencyKey: string; returnUrl: string; cancelUrl: string;
  customerName?: string; customerPhone?: string; description?: string;
}) {
  const body: Record<string, unknown> = {
    amount: params.amount, currency: params.currency,
    reference: params.orderId, order_id: params.orderId,
    description: params.description || `Winger Order ${params.orderId.slice(0, 8)}`,
    return_url: params.returnUrl, success_url: params.returnUrl,
    cancel_url: params.cancelUrl, failure_url: params.cancelUrl,
    callback_url: params.returnUrl,
  };
  if (BRIQ_DEVELOPER_APP_ID) { body.developer_app_id = BRIQ_DEVELOPER_APP_ID; body.app_id = BRIQ_DEVELOPER_APP_ID; }
  if (params.customerName) body.customer_name = params.customerName;
  if (params.customerPhone) body.customer_phone = params.customerPhone;

  const response = await fetch(`${BRIQ_BASE_URL}/api/v1/payments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${BRIQ_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Idempotency-Key': params.idempotencyKey },
    body: JSON.stringify(body),
  });
  const raw = await response.json();
  if (!response.ok) throw new Error(`Briq error (${response.status}): ${JSON.stringify(raw)}`);
  const providerPaymentId = raw.id || raw.payment_id || '';
  const redirectUrl = raw.payment_url || raw.checkout_url || raw.redirect_url || '';
  if (!providerPaymentId || !redirectUrl) throw new Error('Briq did not return payment_id or redirect_url');
  return { providerPaymentId: String(providerPaymentId), redirectUrl: String(redirectUrl), rawPayload: raw };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/checkout/, '').replace(/^\/functions\/v1\/checkout/, '');
  if (!path.startsWith('/')) path = '/' + path;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, anonKey);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── POST /create ──
    if (req.method === 'POST' && (path === '/create' || path === '/create/')) {
      const body = await req.json();
      console.log('[checkout/create] body:', JSON.stringify(body));

      const {
        products, buyer_name, buyer_email, buyer_phone, buyer_city,
        buyer_address, buyer_country, buyer_notes, delivery_type = 'delivery',
        affiliate_code, checkout_session_id, purchase_mode = 'affiliate',
        buyer_user_id, buyer_role,
      } = body;

      if (!products?.length || !buyer_name || !buyer_phone || !checkout_session_id) {
        return json({ success: false, error: 'Missing required fields' }, 400);
      }

      // ── Idempotency: check existing order for this session ──
      const { data: existingOrder } = await admin
        .from('orders').select('id, status, payment_status, total_amount')
        .eq('checkout_session_id', checkout_session_id).maybeSingle();

      let orderId: string;
      let totalAmount: number;
      let deliveryFee = 0;

      if (existingOrder) {
        console.log('[checkout/create] Existing order:', existingOrder.id);
        orderId = existingOrder.id;
        totalAmount = existingOrder.total_amount;
      } else {
        // ── Fetch products ──
        const productIds = products.map((p: any) => p.product_id);
        const { data: dbProducts, error: pErr } = await supabase
          .from('products').select('id, price, commission, vendor_id, title')
          .in('id', productIds).eq('status', 'approved').eq('is_available', true);

        if (pErr || !dbProducts?.length) return json({ success: false, error: 'Products not available' }, 400);

        let subtotal = 0;
        const orderItems = products.map((item: any) => {
          const prod = dbProducts.find((p: any) => p.id === item.product_id);
          if (!prod) throw new Error(`Product not found: ${item.product_id}`);
          const t = prod.price * (item.quantity || 1);
          subtotal += t;
          return { product_id: item.product_id, quantity: item.quantity || 1, price: prod.price, commission_amount: Math.round(prod.price * prod.commission / 100) * (item.quantity || 1) };
        });

        // ── Delivery fee ──
        const vendorIds = [...new Set(dbProducts.map((p: any) => p.vendor_id))];
        const { data: vendorProfiles } = await admin.from('vendor_profiles').select('user_id, city').in('user_id', vendorIds);

        if (delivery_type === 'delivery' && buyer_city) {
          const buyerNorm = buyer_city.trim().toLowerCase();
          let maxFee = 0;
          for (const vp of (vendorProfiles || [])) {
            const vNorm = (vp.city || '').trim().toLowerCase();
            if (vNorm === buyerNorm) {
              const { data: zone } = await supabase.from('delivery_zones').select('base_fee').ilike('city', buyer_city.trim()).eq('is_active', true).limit(1).maybeSingle();
              const fee = zone?.base_fee || 1500;
              if (fee > maxFee) maxFee = fee;
            } else {
              const { data: cf } = await supabase.from('cross_city_fees').select('fee').ilike('from_city', (vp.city || '').trim()).ilike('to_city', buyer_city.trim()).eq('is_active', true).maybeSingle();
              let fee = cf?.fee;
              if (!fee) {
                const { data: rf } = await supabase.from('cross_city_fees').select('fee').ilike('from_city', buyer_city.trim()).ilike('to_city', (vp.city || '').trim()).eq('is_active', true).maybeSingle();
                fee = rf?.fee;
              }
              const f = fee || 5000;
              if (f > maxFee) maxFee = f;
            }
          }
          deliveryFee = maxFee || 5000;
        }

        totalAmount = subtotal + deliveryFee;

        // ── Affiliate link lookup ──
        let affiliateLinkId = null;
        if (affiliate_code) {
          const { data: link } = await supabase.from('affiliate_links').select('id').eq('code', affiliate_code).maybeSingle();
          affiliateLinkId = link?.id || null;
        }

        // ── Create order ──
        const email = buyer_email || `${buyer_phone}@buyer.afrilink`;
        const { data: order, error: oErr } = await admin.from('orders').insert({
          customer_name: buyer_name, customer_email: email, customer_phone: buyer_phone,
          delivery_city: buyer_city, delivery_address: buyer_address, delivery_country: buyer_country || null,
          delivery_type, delivery_fee: deliveryFee, total_amount: totalAmount,
          status: 'pending', payment_status: 'pending_payment',
          confirmation_token: crypto.randomUUID(), checkout_session_id,
          buyer_notes: buyer_notes || null, affiliate_link_id: affiliateLinkId,
          purchase_mode: purchase_mode || 'affiliate',
        }).select().single();
        if (oErr) throw oErr;

        orderId = order.id;

        const items = orderItems.map((i: any) => ({ ...i, order_id: orderId }));
        const { error: iErr } = await admin.from('order_items').insert(items);
        if (iErr) throw iErr;

        console.log('[checkout/create] Order created:', orderId);
      }

      // ── Create payment ──
      const idempotencyKey = `payment_${orderId}`;
      const { data: existingPayment } = await admin.from('payments').select('id, status, provider_payment_id').eq('idempotency_key', idempotencyKey).maybeSingle();

      if (existingPayment) {
        const appUrl = Deno.env.get('VITE_APP_URL') || 'https://shop.afrilink.info';
        return json({
          success: true, order_id: orderId, payment_id: existingPayment.id,
          redirect_url: `${appUrl}/checkout/confirm?payment_id=${existingPayment.id}`,
          total_amount: totalAmount, delivery_fee: deliveryFee, already_exists: true,
        });
      }

      const appUrl = Deno.env.get('VITE_APP_URL') || 'https://shop.afrilink.info';

      if (!BRIQ_API_KEY) {
        return json({ success: false, error: 'Payment provider not configured' }, 503);
      }

      const { data: payment, error: payErr } = await admin.from('payments').insert({
        order_id: orderId, amount_gross: totalAmount, currency: 'TZS',
        status: 'PENDING', mode: 'LIVE', provider: 'BRIQ', idempotency_key: idempotencyKey,
      }).select().single();
      if (payErr) throw payErr;

      try {
        const returnUrl = `${appUrl}/checkout/confirm?payment_id=${payment.id}`;
        const cancelUrl = `${appUrl}/checkout/confirm?payment_id=${payment.id}&status=cancelled`;
        const briqResult = await briqCreatePayment({
          amount: totalAmount, currency: 'TZS', orderId,
          idempotencyKey, returnUrl, cancelUrl,
          customerName: buyer_name, customerPhone: buyer_phone,
        });
        await admin.from('payments').update({ provider_payment_id: briqResult.providerPaymentId, raw_payload: briqResult.rawPayload }).eq('id', payment.id);
        return json({ success: true, order_id: orderId, payment_id: payment.id, redirect_url: briqResult.redirectUrl, total_amount: totalAmount, delivery_fee: deliveryFee }, 201);
      } catch (briqErr) {
        console.error('Briq error:', briqErr);
        await admin.from('payments').update({ status: 'FAILED', raw_payload: { error: String(briqErr) } }).eq('id', payment.id);
        return json({ success: false, error: 'Payment provider error' }, 502);
      }
    }

    return json({ success: false, error: 'Not found' }, 404);
  } catch (err) {
    console.error('[checkout/create] Error:', err);
    return json({ success: false, error: err.message || 'Internal server error' }, 500);
  }
});