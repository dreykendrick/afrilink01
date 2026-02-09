import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const PLATFORM_FEE_PERCENT = parseInt(Deno.env.get('PLATFORM_FEE_PERCENT') || '5');
const MIN_WITHDRAWAL_TZS = parseInt(Deno.env.get('MIN_WITHDRAWAL_TZS') || '20000');
const PAYMENT_PROVIDER_MODE = Deno.env.get('PAYMENT_PROVIDER_MODE') || 'STUB';

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
  // Extract path after /payments-api (handles both /payments-api/path and direct calls)
  let path = url.pathname;
  if (path.includes('/payments-api')) {
    path = path.replace('/payments-api', '');
  }
  // Also handle /functions/v1/payments-api pattern
  if (path.includes('/functions/v1/')) {
    path = path.replace(/^\/functions\/v1\/[^/]+/, '');
  }
  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  console.log('Request path:', path, 'Method:', req.method);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Create clients
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
      console.log('Creating payment for order:', body.order_id);

      if (!body.order_id || !body.amount) {
        return new Response(
          JSON.stringify({ success: false, error: 'order_id and amount are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify order exists and is pending payment
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .select('id, total_amount, payment_status')
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
        .select('id, status')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (existingPayment) {
        console.log('Payment already exists:', existingPayment.id);
        
        // Generate redirect URL based on mode
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

      // Create payment record
      const { data: payment, error: paymentError } = await adminClient
        .from('payments')
        .insert({
          order_id: body.order_id,
          amount_gross: body.amount,
          currency: body.currency || 'TZS',
          status: 'PENDING',
          mode: PAYMENT_PROVIDER_MODE,
          provider: 'BRIQ',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      console.log('Payment created:', payment.id);

      // Generate redirect URL (STUB mode - direct to confirm page)
      const appUrl = Deno.env.get('VITE_APP_URL') || 'https://shop.afrilink.info';
      const redirectUrl = `${appUrl}/checkout/confirm?payment_id=${payment.id}`;

      // In LIVE mode, we would call Briq API here
      // For now, STUB mode returns redirect to our confirm page

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          status: 'PENDING',
          redirect_url: redirectUrl,
          mode: PAYMENT_PROVIDER_MODE,
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

      // Get payment with order details
      const { data: payment, error: paymentError } = await adminClient
        .from('payments')
        .select('*')
        .eq('id', body.payment_id)
        .single();

      if (paymentError || !payment) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // IDEMPOTENCY: Check if already confirmed
      if (payment.status === 'PAID') {
        console.log('Payment already confirmed');
        return new Response(
          JSON.stringify({
            success: true,
            payment_id: payment.id,
            status: 'PAID',
            already_confirmed: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (payment.status !== 'PENDING') {
        return new Response(
          JSON.stringify({ success: false, error: `Cannot confirm payment with status: ${payment.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        return new Response(
          JSON.stringify({ success: false, error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        // Get affiliate info
        const { data: affiliateLink } = await adminClient
          .from('affiliate_links')
          .select('affiliate_id')
          .eq('id', order.affiliate_link_id)
          .single();

        if (affiliateLink) {
          affiliateId = affiliateLink.affiliate_id;

          // Calculate per-product affiliate commission
          for (const item of orderItems) {
            const affiliatePercent = item.products.commission || 0; // Using commission column as affiliate percent
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

      // Vendor payout = (product_subtotal - platform_fee - affiliate_fee) + delivery_fee
      // Group by vendor
      const vendorPayouts: Record<string, { amount: number; vendorId: string }> = {};
      
      for (const item of orderItems) {
        const vendorId = item.products.vendor_id;
        const itemSubtotal = item.price * item.quantity;
        
        // Calculate this item's share of platform fee
        const itemPlatformFee = Math.round(itemSubtotal * PLATFORM_FEE_PERCENT / 100);
        
        // Calculate this item's affiliate fee
        const affiliatePercent = item.products.commission || 0;
        const itemAffiliateFee = affiliateId ? Math.round(itemSubtotal * affiliatePercent / 100) : 0;
        
        // This item's vendor payout (before delivery)
        const itemVendorPayout = itemSubtotal - itemPlatformFee - itemAffiliateFee;
        
        if (!vendorPayouts[vendorId]) {
          vendorPayouts[vendorId] = { amount: 0, vendorId };
        }
        vendorPayouts[vendorId].amount += itemVendorPayout;
      }

      // Add delivery fee to the first vendor (or split equally if multiple)
      const vendorIds = Object.keys(vendorPayouts);
      if (vendorIds.length > 0 && deliveryFee > 0) {
        const deliveryPerVendor = Math.floor(deliveryFee / vendorIds.length);
        const remainder = deliveryFee % vendorIds.length;
        
        vendorIds.forEach((vendorId, index) => {
          vendorPayouts[vendorId].amount += deliveryPerVendor + (index === 0 ? remainder : 0);
        });
      }

      // Verify split integrity: platform_fee + affiliate_fee + sum(vendor_payouts) = product_subtotal + delivery_fee
      const totalVendorPayout = Object.values(vendorPayouts).reduce((sum, v) => sum + v.amount, 0);
      const expectedTotal = productSubtotal + deliveryFee;
      const calculatedTotal = platformFee + totalAffiliateFee + totalVendorPayout;
      
      // Handle rounding discrepancy - add to platform
      let adjustedPlatformFee = platformFee;
      if (calculatedTotal !== expectedTotal) {
        const discrepancy = expectedTotal - calculatedTotal;
        adjustedPlatformFee += discrepancy;
        console.log(`Rounding adjustment: ${discrepancy} added to platform fee`);
      }

      // ========================================
      // CREATE LEDGER ENTRIES
      // ========================================

      // Get or create PLATFORM wallet
      const { data: platformWalletId } = await adminClient.rpc('get_or_create_wallet', {
        p_owner_type: 'PLATFORM',
        p_owner_id: null,
        p_currency: 'TZS',
      });

      // Credit PLATFORM wallet
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

      // Update platform wallet balance
      await adminClient
        .from('wallets')
        .update({ available_balance: adminClient.rpc('', {}) }) // Will use direct SQL
        .eq('id', platformWalletId);

      // Actually update balance using raw update
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

        // Update affiliate wallet balance
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
        await adminClient
          .from('affiliate_links')
          .update({
            conversions: adminClient.rpc('', {}), // Will increment
            commission_earned: adminClient.rpc('', {}),
          })
          .eq('id', order.affiliate_link_id);

        // Get current values and increment
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

        // Update vendor wallet balance
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

      return new Response(
        JSON.stringify({
          success: true,
          payment_id: payment.id,
          status: 'PAID',
          split: {
            platform_fee: adjustedPlatformFee,
            affiliate_fee: totalAffiliateFee,
            vendor_payouts: Object.values(vendorPayouts),
          },
        }),
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
      const walletType = url.searchParams.get('type') || 'VENDOR'; // VENDOR or AFFILIATE

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

      // Get user's wallet
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

      // Get user's wallet
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

      // Create payout request
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

      // Move balance from available to pending
      await adminClient
        .from('wallets')
        .update({
          available_balance: wallet.available_balance - body.amount,
          pending_balance: wallet.pending_balance + body.amount,
        })
        .eq('id', wallet.id);

      // Create ledger entry for hold
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
    // POST /webhooks/briq - Webhook endpoint (STUB logs only)
    // ========================================
    if (req.method === 'POST' && path === '/webhooks/briq') {
      const body = await req.json();
      console.log('Briq webhook received (STUB mode):', JSON.stringify(body));

      // In LIVE mode, we would:
      // 1. Verify webhook signature
      // 2. Process payment status update
      // 3. Call confirm-payment if status is success

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
