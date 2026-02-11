import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Configuration
const PLATFORM_FEE_PERCENT = parseInt(Deno.env.get('PLATFORM_FEE_PERCENT') || '5');
const MIN_WITHDRAWAL_TZS = parseInt(Deno.env.get('MIN_WITHDRAWAL_TZS') || '20000');
const PAYMENT_PROVIDER_MODE = Deno.env.get('PAYMENT_PROVIDER_MODE') || 'STUB';
const BRIQ_BASE_URL = (Deno.env.get('BRIQ_BASE_URL') || 'https://paygrid.briq.tz').replace(/\/$/, '');
const BRIQ_API_KEY = Deno.env.get('BRIQ_API_KEY') || '';
const BRIQ_DEVELOPER_APP_ID = Deno.env.get('BRIQ_DEVELOPER_APP_ID') || '';
const BRIQ_WEBHOOK_SECRET = Deno.env.get('BRIQ_WEBHOOK_SECRET') || '';

// ========================================
// BRIQ PAYMENT PROVIDER ADAPTER
// ========================================

interface BriqCreateResponse {
  id?: string;
  payment_id?: string;
  payment_url?: string;
  checkout_url?: string;
  redirect_url?: string;
  status?: string;
  [key: string]: unknown;
}

interface BriqStatusResponse {
  id?: string;
  payment_id?: string;
  status?: string;
  payment_status?: string;
  state?: string;
  [key: string]: unknown;
}

/**
 * Create a payment via Briq LIVE API
 */
async function briqCreatePayment(params: {
  amount: number;
  currency: string;
  orderId: string;
  idempotencyKey: string;
  returnUrl: string;
  cancelUrl: string;
  customerName?: string;
  customerPhone?: string;
  description?: string;
}): Promise<{ providerPaymentId: string; redirectUrl: string; rawPayload: unknown }> {
  const body: Record<string, unknown> = {
    amount: params.amount,
    currency: params.currency,
    reference: params.orderId,
    order_id: params.orderId,
    description: params.description || `AfriLink Order ${params.orderId.slice(0, 8)}`,
    return_url: params.returnUrl,
    success_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    failure_url: params.cancelUrl,
    callback_url: params.returnUrl,
  };

  // Add developer app ID if available
  if (BRIQ_DEVELOPER_APP_ID) {
    body.developer_app_id = BRIQ_DEVELOPER_APP_ID;
    body.app_id = BRIQ_DEVELOPER_APP_ID;
  }

  // Add customer info if available
  if (params.customerName) body.customer_name = params.customerName;
  if (params.customerPhone) body.customer_phone = params.customerPhone;

  console.log('Briq LIVE: Creating payment at', `${BRIQ_BASE_URL}/api/v1/payments`);

  const response = await fetch(`${BRIQ_BASE_URL}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BRIQ_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Idempotency-Key': params.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const rawPayload = await response.json() as BriqCreateResponse;
  console.log('Briq LIVE: Create response status:', response.status, JSON.stringify(rawPayload));

  if (!response.ok) {
    throw new Error(`Briq API error (${response.status}): ${JSON.stringify(rawPayload)}`);
  }

  // Extract provider payment ID (try common field names)
  const providerPaymentId = rawPayload.id || rawPayload.payment_id || '';
  if (!providerPaymentId) {
    throw new Error('Briq API did not return a payment ID');
  }

  // Extract redirect URL (try common field names)
  const redirectUrl = rawPayload.payment_url || rawPayload.checkout_url || rawPayload.redirect_url || '';
  if (!redirectUrl) {
    throw new Error('Briq API did not return a redirect URL');
  }

  return {
    providerPaymentId: String(providerPaymentId),
    redirectUrl: String(redirectUrl),
    rawPayload,
  };
}

/**
 * Verify payment status via Briq LIVE API
 * Returns normalized status: 'PAID' | 'PENDING' | 'FAILED' | 'CANCELLED'
 */
async function briqVerifyPayment(providerPaymentId: string): Promise<{
  status: 'PAID' | 'PENDING' | 'FAILED' | 'CANCELLED';
  rawPayload: unknown;
}> {
  console.log('Briq LIVE: Verifying payment', providerPaymentId);

  const response = await fetch(`${BRIQ_BASE_URL}/api/v1/payments/${providerPaymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BRIQ_API_KEY}`,
      'Accept': 'application/json',
    },
  });

  const rawPayload = await response.json() as BriqStatusResponse;
  console.log('Briq LIVE: Verify response status:', response.status, JSON.stringify(rawPayload));

  if (!response.ok) {
    throw new Error(`Briq status API error (${response.status}): ${JSON.stringify(rawPayload)}`);
  }

  // Normalize status from Briq response (try common field names)
  const briqStatus = (rawPayload.status || rawPayload.payment_status || rawPayload.state || '').toString().toUpperCase();

  let normalizedStatus: 'PAID' | 'PENDING' | 'FAILED' | 'CANCELLED';
  if (['PAID', 'SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'APPROVED'].includes(briqStatus)) {
    normalizedStatus = 'PAID';
  } else if (['CANCELLED', 'CANCELED', 'EXPIRED'].includes(briqStatus)) {
    normalizedStatus = 'CANCELLED';
  } else if (['FAILED', 'REJECTED', 'DECLINED', 'ERROR'].includes(briqStatus)) {
    normalizedStatus = 'FAILED';
  } else {
    normalizedStatus = 'PENDING';
  }

  return { status: normalizedStatus, rawPayload };
}

// ========================================
// SHARED SPLIT LOGIC (used by confirm-payment and webhooks)
// ========================================

async function applyPaymentSplit(
  adminClient: ReturnType<typeof createClient>,
  paymentId: string,
): Promise<{ success: boolean; error?: string; split?: unknown; already_confirmed?: boolean }> {
  // Get payment
  const { data: payment, error: paymentError } = await adminClient
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (paymentError || !payment) {
    return { success: false, error: 'Payment not found' };
  }

  // IDEMPOTENCY: Check if already confirmed
  if (payment.status === 'PAID') {
    console.log('Payment already confirmed (idempotent)');
    return { success: true, already_confirmed: true };
  }

  if (payment.status !== 'PENDING') {
    return { success: false, error: `Cannot confirm payment with status: ${payment.status}` };
  }

  // Get order with items and products
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select(`
      *,
      order_items(
        quantity,
        price,
        product_id,
        products(id, commission, vendor_id, title)
      )
    `)
    .eq('id', payment.order_id)
    .single();

  if (orderError || !order) {
    return { success: false, error: 'Order not found' };
  }

  // ========================================
  // SPLIT CALCULATION - CRITICAL LOGIC
  // ========================================
  
  const orderItems = order.order_items as Array<{
    quantity: number;
    price: number;
    product_id: string;
    products: { id: string; commission: number; vendor_id: string; title: string };
  }>;

  // Calculate product subtotal (excludes delivery fee)
  const productSubtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = order.delivery_fee || 0;

  // Platform fee applies ONLY to product subtotal
  const platformFee = Math.round(productSubtotal * PLATFORM_FEE_PERCENT / 100);

  // Get affiliate attribution if exists
  let affiliateId: string | null = null;
  let totalAffiliateFee = 0;
  const affiliateBreakdown: Array<{ product_id: string; amount: number; percent: number }> = [];

  if (order.affiliate_link_id) {
    const { data: affiliateLink } = await adminClient
      .from('affiliate_links')
      .select('affiliate_id')
      .eq('id', order.affiliate_link_id)
      .single();

    if (affiliateLink) {
      affiliateId = affiliateLink.affiliate_id;

      for (const item of orderItems) {
        const affiliatePercent = item.products.commission || 0;
        const itemSubtotal = item.price * item.quantity;
        const itemAffiliateAmount = Math.round(itemSubtotal * affiliatePercent / 100);
        
        totalAffiliateFee += itemAffiliateAmount;
        affiliateBreakdown.push({
          product_id: item.product_id,
          amount: itemAffiliateAmount,
          percent: affiliatePercent,
        });
      }
    }
  }

  // Vendor payout grouped by vendor
  const vendorPayouts: Record<string, { amount: number; vendorId: string }> = {};
  
  for (const item of orderItems) {
    const vendorId = item.products.vendor_id;
    const itemSubtotal = item.price * item.quantity;
    const itemPlatformFee = Math.round(itemSubtotal * PLATFORM_FEE_PERCENT / 100);
    const affiliatePercent = item.products.commission || 0;
    const itemAffiliateFee = affiliateId ? Math.round(itemSubtotal * affiliatePercent / 100) : 0;
    const itemVendorPayout = itemSubtotal - itemPlatformFee - itemAffiliateFee;
    
    if (!vendorPayouts[vendorId]) {
      vendorPayouts[vendorId] = { amount: 0, vendorId };
    }
    vendorPayouts[vendorId].amount += itemVendorPayout;
  }

  // Add delivery fee to vendors
  const vendorIds = Object.keys(vendorPayouts);
  if (vendorIds.length > 0 && deliveryFee > 0) {
    const deliveryPerVendor = Math.floor(deliveryFee / vendorIds.length);
    const remainder = deliveryFee % vendorIds.length;
    
    vendorIds.forEach((vendorId, index) => {
      vendorPayouts[vendorId].amount += deliveryPerVendor + (index === 0 ? remainder : 0);
    });
  }

  // Verify split integrity
  const totalVendorPayout = Object.values(vendorPayouts).reduce((sum, v) => sum + v.amount, 0);
  const expectedTotal = productSubtotal + deliveryFee;
  const calculatedTotal = platformFee + totalAffiliateFee + totalVendorPayout;
  
  let adjustedPlatformFee = platformFee;
  if (calculatedTotal !== expectedTotal) {
    const discrepancy = expectedTotal - calculatedTotal;
    adjustedPlatformFee += discrepancy;
    console.log(`Rounding adjustment: ${discrepancy} added to platform fee`);
  }

  // ========================================
  // CREATE LEDGER ENTRIES
  // ========================================

  // Credit PLATFORM wallet
  const { data: platformWalletId } = await adminClient.rpc('get_or_create_wallet', {
    p_owner_type: 'PLATFORM',
    p_owner_id: null,
    p_currency: 'TZS',
  });

  const { error: platformLedgerError } = await adminClient
    .from('ledger_entries')
    .insert({
      wallet_id: platformWalletId,
      payment_id: payment.id,
      order_id: order.id,
      entry_type: 'CREDIT',
      amount: adjustedPlatformFee,
      reason: 'SALE_SPLIT',
      metadata: {
        product_subtotal: productSubtotal,
        delivery_fee: deliveryFee,
        platform_fee_percent: PLATFORM_FEE_PERCENT,
      },
    });

  if (platformLedgerError && !platformLedgerError.message.includes('duplicate')) {
    console.error('Platform ledger error:', platformLedgerError);
  }

  const { data: platformWallet } = await adminClient
    .from('wallets')
    .select('available_balance')
    .eq('id', platformWalletId)
    .single();

  await adminClient
    .from('wallets')
    .update({ available_balance: (platformWallet?.available_balance || 0) + adjustedPlatformFee })
    .eq('id', platformWalletId);

  // Credit AFFILIATE wallet (if applicable)
  if (affiliateId && totalAffiliateFee > 0) {
    const { data: affiliateWalletId } = await adminClient.rpc('get_or_create_wallet', {
      p_owner_type: 'AFFILIATE',
      p_owner_id: affiliateId,
      p_currency: 'TZS',
    });

    const { error: affiliateLedgerError } = await adminClient
      .from('ledger_entries')
      .insert({
        wallet_id: affiliateWalletId,
        payment_id: payment.id,
        order_id: order.id,
        entry_type: 'CREDIT',
        amount: totalAffiliateFee,
        reason: 'SALE_SPLIT',
        metadata: {
          affiliate_breakdown: affiliateBreakdown,
          product_subtotal: productSubtotal,
        },
      });

    if (affiliateLedgerError && !affiliateLedgerError.message.includes('duplicate')) {
      console.error('Affiliate ledger error:', affiliateLedgerError);
    }

    const { data: affiliateWallet } = await adminClient
      .from('wallets')
      .select('available_balance')
      .eq('id', affiliateWalletId)
      .single();

    await adminClient
      .from('wallets')
      .update({ available_balance: (affiliateWallet?.available_balance || 0) + totalAffiliateFee })
      .eq('id', affiliateWalletId);

    // Update affiliate link stats
    const { data: linkData } = await adminClient
      .from('affiliate_links')
      .select('conversions, commission_earned')
      .eq('id', order.affiliate_link_id)
      .single();

    await adminClient
      .from('affiliate_links')
      .update({
        conversions: (linkData?.conversions || 0) + 1,
        commission_earned: (linkData?.commission_earned || 0) + totalAffiliateFee,
      })
      .eq('id', order.affiliate_link_id);
  }

  // Credit VENDOR wallets
  for (const vendorId of vendorIds) {
    const vendorPayout = vendorPayouts[vendorId];

    const { data: vendorWalletId } = await adminClient.rpc('get_or_create_wallet', {
      p_owner_type: 'VENDOR',
      p_owner_id: vendorId,
      p_currency: 'TZS',
    });

    const { error: vendorLedgerError } = await adminClient
      .from('ledger_entries')
      .insert({
        wallet_id: vendorWalletId,
        payment_id: payment.id,
        order_id: order.id,
        entry_type: 'CREDIT',
        amount: vendorPayout.amount,
        reason: 'SALE_SPLIT',
        metadata: {
          vendor_id: vendorId,
          product_subtotal: productSubtotal,
          delivery_fee_share: deliveryFee / vendorIds.length,
          platform_fee_percent: PLATFORM_FEE_PERCENT,
        },
      });

    if (vendorLedgerError && !vendorLedgerError.message.includes('duplicate')) {
      console.error('Vendor ledger error:', vendorLedgerError);
    }

    const { data: vendorWallet } = await adminClient
      .from('wallets')
      .select('available_balance')
      .eq('id', vendorWalletId)
      .single();

    await adminClient
      .from('wallets')
      .update({ available_balance: (vendorWallet?.available_balance || 0) + vendorPayout.amount })
      .eq('id', vendorWalletId);
  }

  // ========================================
  // UPDATE PAYMENT AND ORDER STATUS
  // ========================================

  await adminClient
    .from('payments')
    .update({ status: 'PAID' })
    .eq('id', payment.id);

  await adminClient
    .from('orders')
    .update({
      payment_status: 'payment_confirmed',
      status: 'processing',
    })
    .eq('id', order.id);

  console.log('Payment confirmed and funds split:', {
    payment_id: payment.id,
    platform_fee: adjustedPlatformFee,
    affiliate_fee: totalAffiliateFee,
    vendor_payouts: vendorPayouts,
  });

  return {
    success: true,
    split: {
      platform_fee: adjustedPlatformFee,
      affiliate_fee: totalAffiliateFee,
      vendor_payouts: Object.values(vendorPayouts),
    },
  };
}

// ========================================
// MAIN REQUEST HANDLER
// ========================================

interface CreatePaymentRequest {
  order_id: string;
  amount: number;
  currency?: string;
  return_url?: string;
}

interface ConfirmPaymentRequest {
  payment_id: string;
}

interface RequestPayoutRequest {
  amount: number;
  destination_type: 'MOBILE_MONEY' | 'BANK';
  destination_details: {
    phone?: string;
    bank_name?: string;
    account_number?: string;
    account_name?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  let path = url.pathname;
  if (path.includes('/payments-api')) {
    path = path.replace('/payments-api', '');
  }
  if (path.includes('/functions/v1/')) {
    path = path.replace(/^\/functions\/v1\/[^/]+/, '');
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  console.log('Request path:', path, 'Method:', req.method);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ========================================
    // POST /create-payment - Create a payment for an order
    // ========================================
    if (req.method === 'POST' && path === '/create-payment') {
      const body: CreatePaymentRequest = await req.json();
      console.log('Creating payment for order:', body.order_id, 'Mode:', PAYMENT_PROVIDER_MODE);

      if (!body.order_id || !body.amount) {
        return new Response(
          JSON.stringify({ success: false, error: 'order_id and amount are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify order exists
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .select('id, total_amount, payment_status, customer_name, customer_phone')
        .eq('id', body.order_id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ success: false, error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Idempotency key based on order_id
      const idempotencyKey = `payment_${body.order_id}`;

      // Check for existing payment (idempotency)
      const { data: existingPayment } = await adminClient
        .from('payments')
        .select('id, status, provider_payment_id')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (existingPayment) {
        console.log('Payment already exists:', existingPayment.id);
        
        const appUrl = Deno.env.get('VITE_APP_URL') || 'https://shop.afrilink.info';
        const redirectUrl = `${appUrl}/checkout/confirm?payment_id=${existingPayment.id}`;
        
        return new Response(
          JSON.stringify({
            success: true,
            payment_id: existingPayment.id,
            status: existingPayment.status,
            redirect_url: redirectUrl,
            already_exists: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const appUrl = Deno.env.get('VITE_APP_URL') || 'https://shop.afrilink.info';

      // ── LIVE MODE: Call Briq API ──
      if (PAYMENT_PROVIDER_MODE === 'LIVE' && BRIQ_API_KEY) {
        console.log('Processing in LIVE mode');

        // Create payment record first as PENDING
        const { data: payment, error: paymentError } = await adminClient
          .from('payments')
          .insert({
            order_id: body.order_id,
            amount_gross: body.amount,
            currency: body.currency || 'TZS',
            status: 'PENDING',
            mode: 'LIVE',
            provider: 'BRIQ',
            idempotency_key: idempotencyKey,
          })
          .select()
          .single();

        if (paymentError) throw paymentError;

        try {
          const returnUrl = `${appUrl}/checkout/confirm?payment_id=${payment.id}`;
          const cancelUrl = `${appUrl}/checkout/confirm?payment_id=${payment.id}&status=cancelled`;

          const briqResult = await briqCreatePayment({
            amount: body.amount,
            currency: body.currency || 'TZS',
            orderId: body.order_id,
            idempotencyKey,
            returnUrl,
            cancelUrl,
            customerName: order.customer_name,
            customerPhone: order.customer_phone,
            description: `AfriLink Order ${body.order_id.slice(0, 8)}`,
          });

          // Save provider payment ID and raw payload
          await adminClient
            .from('payments')
            .update({
              provider_payment_id: briqResult.providerPaymentId,
              raw_payload: briqResult.rawPayload as Record<string, unknown>,
            })
            .eq('id', payment.id);

          console.log('Briq LIVE payment created:', briqResult.providerPaymentId);

          return new Response(
            JSON.stringify({
              success: true,
              payment_id: payment.id,
              status: 'PENDING',
              redirect_url: briqResult.redirectUrl,
              mode: 'LIVE',
              provider_payment_id: briqResult.providerPaymentId,
            }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (briqError) {
          console.error('Briq API call failed:', briqError);
          // Mark payment as FAILED
          await adminClient
            .from('payments')
            .update({ status: 'FAILED', raw_payload: { error: String(briqError) } as Record<string, unknown> })
            .eq('id', payment.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Payment provider error. Please try again.',
              payment_id: payment.id,
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ── STUB MODE: Direct confirm flow ──
      console.log('Processing in STUB mode');

      const { data: payment, error: paymentError } = await adminClient
        .from('payments')
        .insert({
          order_id: body.order_id,
          amount_gross: body.amount,
          currency: body.currency || 'TZS',
          status: 'PENDING',
          mode: 'STUB',
          provider: 'BRIQ',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      console.log('STUB payment created:', payment.id);

      const redirectUrl = `${appUrl}/checkout/confirm?payment_id=${payment.id}`;

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          status: 'PENDING',
          redirect_url: redirectUrl,
          mode: 'STUB',
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // POST /confirm-payment - Confirm payment and split funds
    // ========================================
    if (req.method === 'POST' && path === '/confirm-payment') {
      const body: ConfirmPaymentRequest = await req.json();
      console.log('Confirming payment:', body.payment_id);

      if (!body.payment_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'payment_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get payment to check mode
      const { data: payment, error: payErr } = await adminClient
        .from('payments')
        .select('id, status, mode, provider_payment_id')
        .eq('id', body.payment_id)
        .single();

      if (payErr || !payment) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // IDEMPOTENCY: already paid
      if (payment.status === 'PAID') {
        return new Response(
          JSON.stringify({ success: true, payment_id: payment.id, status: 'PAID', already_confirmed: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── LIVE MODE: Verify with Briq before confirming ──
      if (payment.mode === 'LIVE' && payment.provider_payment_id) {
        console.log('LIVE mode: verifying payment with Briq before split');
        
        try {
          const verification = await briqVerifyPayment(payment.provider_payment_id);
          
          // Save raw verification response
          await adminClient
            .from('payments')
            .update({ raw_payload: verification.rawPayload as Record<string, unknown> })
            .eq('id', payment.id);

          if (verification.status === 'PAID') {
            // Payment verified as paid - apply split
            const splitResult = await applyPaymentSplit(adminClient, payment.id);
            
            const statusCode = splitResult.success ? 200 : 400;
            return new Response(
              JSON.stringify({ ...splitResult, payment_id: payment.id, status: splitResult.success ? 'PAID' : payment.status }),
              { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else if (verification.status === 'CANCELLED' || verification.status === 'FAILED') {
            // Payment failed/cancelled at provider
            await adminClient
              .from('payments')
              .update({ status: verification.status })
              .eq('id', payment.id);

            await adminClient
              .from('orders')
              .update({ payment_status: 'payment_failed' })
              .eq('id', (await adminClient.from('payments').select('order_id').eq('id', payment.id).single()).data?.order_id);

            return new Response(
              JSON.stringify({
                success: false,
                payment_id: payment.id,
                status: verification.status,
                error: `Payment ${verification.status.toLowerCase()} by provider`,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            // Still pending
            return new Response(
              JSON.stringify({
                success: false,
                payment_id: payment.id,
                status: 'PENDING',
                error: 'Payment is still being processed. Please wait.',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (verifyError) {
          console.error('Briq verification error:', verifyError);
          return new Response(
            JSON.stringify({
              success: false,
              payment_id: payment.id,
              error: 'Unable to verify payment status. Please try again shortly.',
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ── STUB MODE: Apply split directly ──
      if (payment.status !== 'PENDING') {
        return new Response(
          JSON.stringify({ success: false, error: `Cannot confirm payment with status: ${payment.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const splitResult = await applyPaymentSplit(adminClient, payment.id);
      
      const statusCode = splitResult.success ? 200 : 400;
      return new Response(
        JSON.stringify({ ...splitResult, payment_id: payment.id, status: splitResult.success ? 'PAID' : payment.status }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // GET /payment-status - Check payment status (used by frontend polling)
    // ========================================
    if (req.method === 'GET' && path === '/payment-status') {
      const paymentId = url.searchParams.get('payment_id');
      if (!paymentId) {
        return new Response(
          JSON.stringify({ success: false, error: 'payment_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: payment } = await adminClient
        .from('payments')
        .select('id, status, mode, order_id')
        .eq('id', paymentId)
        .single();

      if (!payment) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, payment_id: payment.id, status: payment.status, mode: payment.mode }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // GET /wallet - Get user's wallet balance
    // ========================================
    if (req.method === 'GET' && path === '/wallet') {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = userData.user.id;
      const walletType = url.searchParams.get('type') || 'VENDOR';

      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('owner_type', walletType)
        .eq('owner_id', userId)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          wallet: wallet || {
            available_balance: 0,
            pending_balance: 0,
            currency: 'TZS',
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // GET /ledger - Get user's ledger entries
    // ========================================
    if (req.method === 'GET' && path === '/ledger') {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = userData.user.id;
      const walletType = url.searchParams.get('type') || 'VENDOR';
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('owner_type', walletType)
        .eq('owner_id', userId)
        .single();

      if (!wallet) {
        return new Response(
          JSON.stringify({ success: true, entries: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: entries } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      return new Response(
        JSON.stringify({ success: true, entries: entries || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // POST /request-payout - Request a payout
    // ========================================
    if (req.method === 'POST' && path === '/request-payout') {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = userData.user.id;
      const body: RequestPayoutRequest = await req.json();
      const walletType = url.searchParams.get('type') || 'VENDOR';

      if (!body.amount || !body.destination_type || !body.destination_details) {
        return new Response(
          JSON.stringify({ success: false, error: 'amount, destination_type, and destination_details are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.amount < MIN_WITHDRAWAL_TZS) {
        return new Response(
          JSON.stringify({ success: false, error: `Minimum withdrawal is ${MIN_WITHDRAWAL_TZS} TZS` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: wallet } = await adminClient
        .from('wallets')
        .select('id, available_balance, pending_balance')
        .eq('owner_type', walletType)
        .eq('owner_id', userId)
        .single();

      if (!wallet) {
        return new Response(
          JSON.stringify({ success: false, error: 'Wallet not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.amount > wallet.available_balance) {
        return new Response(
          JSON.stringify({ success: false, error: 'Insufficient balance' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: payoutRequest, error: payoutError } = await adminClient
        .from('payout_requests')
        .insert({
          wallet_id: wallet.id,
          user_id: userId,
          amount: body.amount,
          destination_type: body.destination_type,
          destination_details: body.destination_details,
          status: 'REQUESTED',
        })
        .select()
        .single();

      if (payoutError) throw payoutError;

      await adminClient
        .from('wallets')
        .update({
          available_balance: wallet.available_balance - body.amount,
          pending_balance: wallet.pending_balance + body.amount,
        })
        .eq('id', wallet.id);

      await adminClient
        .from('ledger_entries')
        .insert({
          wallet_id: wallet.id,
          entry_type: 'DEBIT',
          amount: body.amount,
          reason: 'PAYOUT_HOLD',
          metadata: { payout_request_id: payoutRequest.id },
        });

      return new Response(
        JSON.stringify({
          success: true,
          payout_request_id: payoutRequest.id,
          status: 'REQUESTED',
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // GET /payout-requests - Get user's payout requests
    // ========================================
    if (req.method === 'GET' && path === '/payout-requests') {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: requests } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      return new Response(
        JSON.stringify({ success: true, requests: requests || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // POST /webhooks/briq - Webhook endpoint
    // ========================================
    if (req.method === 'POST' && path === '/webhooks/briq') {
      const rawBody = await req.text();
      console.log('Briq webhook received:', rawBody);

      // Verify webhook signature if secret is configured
      if (BRIQ_WEBHOOK_SECRET) {
        const signature = req.headers.get('x-briq-signature') || req.headers.get('x-webhook-signature') || '';
        // Note: Signature verification depends on Briq's specific algorithm.
        // For now, log a warning if signature doesn't match but don't block processing.
        // We rely on server-side verification via GET /api/v1/payments/{id} instead.
        if (signature) {
          console.log('Webhook signature present, verification TBD:', signature);
        } else {
          console.log('No webhook signature header found, proceeding with server-side verification');
        }
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid JSON' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract provider payment ID from webhook payload (try common field names)
      const providerPaymentId = payload.id || payload.payment_id || payload.transaction_id || '';

      if (providerPaymentId) {
        // Find our internal payment by provider_payment_id
        const { data: payment } = await adminClient
          .from('payments')
          .select('id, status')
          .eq('provider_payment_id', String(providerPaymentId))
          .single();

        if (payment && payment.status === 'PENDING') {
          console.log('Webhook: triggering server-side verification for payment:', payment.id);
          
          // Server-side verification (never trust webhook payload for status)
          try {
            const verification = await briqVerifyPayment(String(providerPaymentId));
            
            if (verification.status === 'PAID') {
              const splitResult = await applyPaymentSplit(adminClient, payment.id);
              console.log('Webhook: payment confirmed via server-side verification:', splitResult);
            } else if (verification.status === 'FAILED' || verification.status === 'CANCELLED') {
              await adminClient
                .from('payments')
                .update({ status: verification.status, raw_payload: verification.rawPayload as Record<string, unknown> })
                .eq('id', payment.id);
              console.log('Webhook: payment marked as', verification.status);
            } else {
              console.log('Webhook: payment still pending, skipping');
            }
          } catch (verifyError) {
            console.error('Webhook: server-side verification failed:', verifyError);
            // Don't block - will be retried or confirmed via return URL
          }
        } else if (payment) {
          console.log('Webhook: payment already processed, status:', payment.status);
        } else {
          console.log('Webhook: no matching payment found for provider ID:', providerPaymentId);
        }
      }

      // Always return 200 to acknowledge receipt
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Payments API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
