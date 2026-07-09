// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  products: Array<{ product_id: string; quantity: number }>;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_city: string;
  buyer_address: string;
  buyer_country?: string;
  buyer_notes?: string;
  delivery_type: 'pickup' | 'delivery';
  affiliate_code?: string;
  checkout_session_id: string;
  purchase_mode?: 'affiliate' | 'marketplace';
  buyer_user_id?: string;
  buyer_role?: string;
}

interface ConfirmPaymentRequest {
  order_id: string;
  payment_reference: string;
}

interface ConfirmDeliveryRequest {
  order_id: string;
  token: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/checkout-api', '');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // GET /debug/product/:id - Temporary debug endpoint (no filters)
    if (req.method === 'GET' && path.startsWith('/debug/product/')) {
      const productId = path.replace('/debug/product/', '');
      console.log('DEBUG: Checking product existence:', productId);
      console.log('DEBUG: SUPABASE_URL =', supabaseUrl);
      console.log('DEBUG: Project ref =', supabaseUrl.match(/https:\/\/([^.]+)/)?.[1]);

      const { data: product, error } = await adminClient
        .from('products')
        .select('id, status, is_available, slug, title')
        .eq('id', productId)
        .maybeSingle();

      return new Response(JSON.stringify({
        exists: !!product,
        id: product?.id || null,
        status: product?.status || null,
        is_available: product?.is_available ?? null,
        slug: product?.slug || null,
        title: product?.title || null,
        supabase_project_ref: supabaseUrl.match(/https:\/\/([^.]+)/)?.[1],
        error: error?.message || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /products - List approved products
    if (req.method === 'GET' && (path === '/products' || path === '/products/')) {
      console.log('Fetching approved products');
      
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          title,
          description,
          price,
          commission,
          category,
          image_url,
          image_urls,
          slug,
          vendor_id
        `)
        .eq('status', 'approved')
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch vendor profiles separately to avoid join issues
      const vendorIds = [...new Set((products || []).map((p: { vendor_id: string }) => p.vendor_id))];
      const { data: vendors } = await supabase
        .from('vendor_profiles')
        .select('user_id, business_name, city')
        .in('user_id', vendorIds);

      const vendorMap = new Map((vendors || []).map((v: { user_id: string; business_name: string; city: string }) => [v.user_id, v]));

      const safeProducts = (products || []).map((p: Record<string, unknown>) => {
        const vendor = vendorMap.get(p.vendor_id as string) as { business_name?: string; city?: string } | undefined;
        return {
          id: p.id,
          title: p.title,
          description: p.description,
          price: p.price,
          commission: p.commission,
          category: p.category,
          image_url: p.image_url,
          image_urls: p.image_urls,
          slug: p.slug,
          vendor_name: vendor?.business_name || 'Winger Vendor',
          vendor_city: vendor?.city,
        };
      });

      return new Response(JSON.stringify({ success: true, products: safeProducts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /products/:slug - Product detail by slug or ID
    if (req.method === 'GET' && path.startsWith('/products/')) {
      const slugOrId = path.replace('/products/', '');
      console.log('Fetching product:', slugOrId);

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

      // First: try with filters (approved + available)
      let query = supabase
        .from('products')
        .select('id, title, description, price, commission, category, image_url, image_urls, slug, vendor_id')
        .eq('status', 'approved')
        .eq('is_available', true);

      if (isUuid) {
        query = query.eq('id', slugOrId);
      } else {
        query = query.eq('slug', slugOrId);
      }

      let { data: product, error } = await query.maybeSingle();

      if (error) {
        console.error('Product query error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Slug fallback: if not UUID and exact slug not found, try stripping trailing -XXXXXX suffix
      // (frontend getProductSlug appends a 6-char ID prefix that the DB slug doesn't have)
      if (!product && !isUuid) {
        const strippedSlug = slugOrId.replace(/-[a-f0-9]{6,8}$/, '');
        if (strippedSlug !== slugOrId) {
          console.log('Trying stripped slug fallback:', strippedSlug);
          const { data: fallbackProduct } = await supabase
            .from('products')
            .select('id, title, description, price, commission, category, image_url, image_urls, slug, vendor_id')
            .eq('status', 'approved')
            .eq('is_available', true)
            .eq('slug', strippedSlug)
            .maybeSingle();
          product = fallbackProduct;
        }
      }

      // If still not found, check if it exists at all (to give better reason)
      if (!product) {
        let rawQuery = adminClient
          .from('products')
          .select('id, status, is_available');
        if (isUuid) {
          rawQuery = rawQuery.eq('id', slugOrId);
        } else {
          // Check both exact and stripped slug
          const strippedSlug = slugOrId.replace(/-[a-f0-9]{6,8}$/, '');
          rawQuery = rawQuery.or(`slug.eq.${slugOrId},slug.eq.${strippedSlug}`);
        }
        const { data: rawProduct } = await rawQuery.maybeSingle();

        if (rawProduct) {
          console.log('Product exists but filtered out:', slugOrId, 'status:', rawProduct.status, 'is_available:', rawProduct.is_available);
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Product not available',
            reason: 'not_approved_or_unavailable'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Product not found at all:', slugOrId);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Product not found',
          reason: 'not_found'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch vendor profile (use admin client — vendor_profiles RLS blocks anon)
      const { data: vendor } = await adminClient
        .from('vendor_profiles')
        .select('business_name, city, pickup_location, vendor_lat, vendor_lng, vendor_address')
        .eq('user_id', product.vendor_id)
        .single();

      const safeProduct = {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        commission: product.commission,
        category: product.category,
        image_url: product.image_url,
        image_urls: product.image_urls,
        slug: product.slug,
        vendor_name: vendor?.business_name || 'Winger Vendor',
        vendor_city: vendor?.city,
        vendor_lat: vendor?.vendor_lat || null,
        vendor_lng: vendor?.vendor_lng || null,
        vendor_address: vendor?.vendor_address || null,
        pickup_available: !!vendor?.pickup_location,
      };

      return new Response(JSON.stringify({ success: true, product: safeProduct }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /delivery-fees - Get delivery pricing
    if (req.method === 'GET' && path === '/delivery-fees') {
      const city = url.searchParams.get('city');
      
      let query = supabase
        .from('delivery_zones')
        .select('city, zone_name, base_fee')
        .eq('is_active', true);
      
      if (city) {
        query = query.eq('city', city);
      }

      const { data: zones, error } = await query;
      if (error) throw error;

      const { data: crossCity, error: crossError } = await supabase
        .from('cross_city_fees')
        .select('from_city, to_city, fee')
        .eq('is_active', true);
      
      if (crossError) throw crossError;

      return new Response(JSON.stringify({ 
        success: true, 
        zones: zones || [],
        cross_city: crossCity || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /orders - Create new order
    if (req.method === 'POST' && path === '/orders') {
      const body: CreateOrderRequest = await req.json();
      console.log('Creating order:', body.checkout_session_id);

      if (!body.products?.length || !body.buyer_name || !body.buyer_email || !body.buyer_phone || !body.checkout_session_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: products, buyer_name, buyer_email, buyer_phone, checkout_session_id' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // IDEMPOTENCY CHECK
      const { data: existingOrder } = await adminClient
        .from('orders')
        .select('id, status, payment_status, total_amount')
        .eq('checkout_session_id', body.checkout_session_id)
        .single();

      if (existingOrder) {
        console.log('Order already exists for session:', body.checkout_session_id);
        return new Response(JSON.stringify({ 
          success: true, 
          order_id: existingOrder.id,
          status: existingOrder.status,
          payment_status: existingOrder.payment_status,
          total_amount: existingOrder.total_amount,
          already_exists: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch product details
      const productIds = body.products.map(p => p.product_id);
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('id, price, commission, vendor_id, title')
        .in('id', productIds)
        .eq('status', 'approved')
        .eq('is_available', true);

      if (productError || !products?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'One or more products are not available' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Calculate totals
      let subtotal = 0;
      const orderItems = body.products.map(item => {
        const product = (products as Array<{ id: string; price: number; commission: number }>).find(p => p.id === item.product_id);
        if (!product) throw new Error(`Product not found: ${item.product_id}`);
        
        const itemTotal = product.price * item.quantity;
        subtotal += itemTotal;
        
        return {
          product_id: item.product_id,
          quantity: item.quantity,
          price: product.price,
          commission_amount: (product.price * product.commission / 100) * item.quantity,
        };
      });

      // Fetch vendor profiles (needed for delivery fee + location response)
      const vendorIds = [...new Set((products as Array<{ vendor_id: string }>).map(p => p.vendor_id))];
      const { data: vendorProfiles } = await adminClient
        .from('vendor_profiles')
        .select('user_id, city, vendor_lat, vendor_lng, vendor_address')
        .in('user_id', vendorIds);

      console.log('[Checkout] Vendor profiles fetched:', JSON.stringify(vendorProfiles));

      // Calculate delivery fee based on vendor city vs buyer city
      let deliveryFee = 0;
      let deliveryLabel = 'delivery';
      if (body.delivery_type === 'delivery') {

        const buyerCityNorm = (body.buyer_city || '').trim().toLowerCase();
        let maxFee = 0;

        for (const vendor of (vendorProfiles || [])) {
          const vendorCityNorm = (vendor.city || '').trim().toLowerCase();

          if (vendorCityNorm && vendorCityNorm === buyerCityNorm) {
            // Same city: use delivery_zones base_fee
            const { data: zone } = await supabase
              .from('delivery_zones')
              .select('base_fee')
              .ilike('city', body.buyer_city.trim())
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            const fee = zone?.base_fee || 1500;
            if (fee > maxFee) maxFee = fee;
            deliveryLabel = 'Local delivery (same city)';
          } else {
            // Different city: check cross_city_fees first
            const fromCity = vendor.city || '';
            const toCity = body.buyer_city || '';
            const { data: crossFee } = await supabase
              .from('cross_city_fees')
              .select('fee')
              .ilike('from_city', fromCity.trim())
              .ilike('to_city', toCity.trim())
              .eq('is_active', true)
              .maybeSingle();

            // Also check reverse direction
            let fee = crossFee?.fee;
            if (!fee) {
              const { data: reverseFee } = await supabase
                .from('cross_city_fees')
                .select('fee')
                .ilike('from_city', toCity.trim())
                .ilike('to_city', fromCity.trim())
                .eq('is_active', true)
                .maybeSingle();
              fee = reverseFee?.fee;
            }

            const finalFee = fee || 5000; // default intercity fee
            if (finalFee > maxFee) maxFee = finalFee;
            deliveryLabel = 'Intercity delivery';
          }
        }

        deliveryFee = maxFee || 5000;
      }

      const totalAmount = subtotal + deliveryFee;
      const confirmationToken = crypto.randomUUID();

      // Look up affiliate link
      let affiliateLinkId = null;
      if (body.affiliate_code) {
        const { data: link } = await supabase
          .from('affiliate_links')
          .select('id')
          .eq('code', body.affiliate_code)
          .single();
        affiliateLinkId = link?.id;
      }

      // Create order
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .insert({
          customer_name: body.buyer_name,
          customer_email: body.buyer_email,
          customer_phone: body.buyer_phone,
          delivery_city: body.buyer_city,
          delivery_address: body.buyer_address,
          delivery_country: body.buyer_country || null,
          delivery_type: body.delivery_type,
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          status: 'pending',
          payment_status: 'pending_payment',
          confirmation_token: confirmationToken,
          checkout_session_id: body.checkout_session_id,
          buyer_notes: body.buyer_notes,
          affiliate_link_id: affiliateLinkId,
          purchase_mode: body.purchase_mode || 'affiliate',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const itemsWithOrderId = orderItems.map(item => ({
        ...item,
        order_id: (order as { id: string }).id,
      }));

      const { error: itemsError } = await adminClient
        .from('order_items')
        .insert(itemsWithOrderId);

      if (itemsError) throw itemsError;

      console.log('Order created successfully:', (order as { id: string }).id);

      // Collect vendor locations for the response
      const vendorLocations = (vendorProfiles || []).map((vp: any) => ({
        vendor_id: vp.user_id,
        city: vp.city,
        vendor_lat: vp.vendor_lat || null,
        vendor_lng: vp.vendor_lng || null,
        vendor_address: vp.vendor_address || null,
      }));

      return new Response(JSON.stringify({ 
        success: true, 
        order_id: (order as { id: string }).id,
        total_amount: totalAmount,
        delivery_fee: deliveryFee,
        payment_status: 'pending_payment',
        vendor_locations: vendorLocations,
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /confirm-payment - Confirm payment and notify vendor
    if (req.method === 'POST' && path === '/confirm-payment') {
      const body: ConfirmPaymentRequest = await req.json();
      console.log('Confirming payment for order:', body.order_id);

      if (!body.order_id || !body.payment_reference) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'order_id and payment_reference are required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .select('*, order_items(*, products(title, vendor_id))')
        .eq('id', body.order_id)
        .single();

      if (orderError || !order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const orderData = order as Record<string, unknown>;

      // IDEMPOTENCY: Check if already confirmed with same reference
      if (orderData.payment_status === 'payment_confirmed' && orderData.payment_reference === body.payment_reference) {
        console.log('Payment already confirmed for this reference');
        return new Response(JSON.stringify({ 
          success: true, 
          order_id: orderData.id,
          already_confirmed: true,
          status: orderData.status,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (orderData.payment_status === 'payment_confirmed') {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Order already has a confirmed payment' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update order to confirmed
      const { error: updateError } = await adminClient
        .from('orders')
        .update({
          payment_status: 'payment_confirmed',
          payment_reference: body.payment_reference,
          status: 'processing',
        })
        .eq('id', body.order_id);

      if (updateError) throw updateError;

      // Notify vendor via SMS (idempotent)
      await notifyVendor(adminClient, orderData);

      // Send in-app notification to vendor(s)
      const items = orderData.order_items as Array<{ quantity: number; price: number; products: { vendor_id: string; title: string } }> | undefined;
      if (items?.length) {
        const vendorIds = new Set<string>();
        const productTitles: string[] = [];
        items.forEach(item => {
          if (item.products?.vendor_id) vendorIds.add(item.products.vendor_id);
          if (item.products?.title) productTitles.push(item.products.title);
        });

        for (const vendorId of vendorIds) {
          try {
            await adminClient
              .from('notifications')
              .insert({
                user_id: vendorId,
                title: '🛒 New Order Received!',
                message: `You have a new order for: ${productTitles.join(', ')}. Total: TZS ${orderData.total_amount}. Buyer: ${orderData.customer_name}`,
                type: 'success',
                link: '/dashboard',
                read: false,
              });
            console.log(`In-app notification sent to vendor ${vendorId}`);
          } catch (err) {
            console.error(`Failed to create in-app notification for vendor ${vendorId}:`, err);
          }
        }
      }

      console.log('Payment confirmed for order:', body.order_id);

      return new Response(JSON.stringify({ 
        success: true, 
        order_id: orderData.id,
        status: 'processing',
        payment_status: 'payment_confirmed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /receipt/:orderId - Get order receipt
    if (req.method === 'GET' && path.startsWith('/receipt/')) {
      const orderId = path.replace('/receipt/', '');
      console.log('Fetching receipt for order:', orderId);

      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer_name,
          customer_email,
          customer_phone,
          delivery_city,
          delivery_address,
          delivery_type,
          delivery_fee,
          total_amount,
          status,
          payment_status,
          created_at,
          order_items(
            quantity,
            price,
            products(title, image_url)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error || !order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, order }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /confirm-delivery - Buyer confirms delivery
    if (req.method === 'POST' && path === '/confirm-delivery') {
      const body: ConfirmDeliveryRequest = await req.json();
      console.log('Confirming delivery for order:', body.order_id);

      if (!body.order_id || !body.token) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'order_id and token are required' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .select('id, status, confirmation_token')
        .eq('id', body.order_id)
        .single();

      if (orderError || !order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const orderData = order as { id: string; status: string; confirmation_token: string };

      // IDEMPOTENCY: Already confirmed
      if (orderData.status === 'confirmed') {
        return new Response(JSON.stringify({ 
          success: true, 
          already_confirmed: true,
          status: 'confirmed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify token
      if (orderData.confirmation_token !== body.token) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid confirmation token' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await adminClient
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', body.order_id);

      if (updateError) throw updateError;

      console.log('Delivery confirmed for order:', body.order_id);

      return new Response(JSON.stringify({ 
        success: true, 
        status: 'confirmed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /track-click or /affiliate-clicks - Track affiliate link click (uses service role, no RLS issue)
    if (req.method === 'POST' && (path === '/track-click' || path === '/affiliate-clicks')) {
      const body = await req.json();
      // Accept both "code" and "affiliate_code" field names
      const code = body?.code || body?.affiliate_code;
      if (!code) {
        return new Response(JSON.stringify({ success: false, error: 'code required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data } = await adminClient
        .from('affiliate_links')
        .select('id, clicks')
        .eq('code', code)
        .maybeSingle();

      if (data) {
        await adminClient
          .from('affiliate_links')
          .update({ clicks: (data.clicks || 0) + 1 })
          .eq('id', data.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Checkout API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper: Notify vendor via SMS (idempotent)
// deno-lint-ignore no-explicit-any
async function notifyVendor(
  adminClient: any,
  order: Record<string, unknown>
): Promise<void> {
  if (order.vendor_notified_at) {
    console.log('Vendor already notified for order:', order.id);
    return;
  }

  const items = order.order_items as Array<{ products: { vendor_id: string; title: string } }>;
  if (!items?.length) return;

  const vendorId = items[0].products.vendor_id;

  const { data: profileData } = await adminClient
    .from('profiles')
    .select('phone')
    .eq('id', vendorId)
    .single();

  const profile = profileData as { phone?: string } | null;

  if (!profile?.phone) {
    console.log('Vendor has no phone number:', vendorId);
    return;
  }

  // Check for existing notification
  const { data: existingLog } = await adminClient
    .from('vendor_notifications_log')
    .select('id')
    .eq('order_id', order.id as string)
    .eq('notification_type', 'sms')
    .in('status', ['sent', 'delivered'])
    .limit(1);

  if ((existingLog as Array<unknown> | null)?.length) {
    console.log('Notification already sent for order:', order.id);
    return;
  }

  const productTitles = items.map(i => i.products.title).join(', ');
  const message = `New order received! Order #${(order.id as string).slice(0, 8)}. Items: ${productTitles}. Total: TZS ${order.total_amount}. Buyer: ${order.customer_name}, ${order.customer_phone}`;

  const briqApiKey = Deno.env.get('BRIQ_API_KEY');
  const briqAppId = Deno.env.get('BRIQ_DEVELOPER_APP_ID');

  let status = 'pending';
  let providerResponse: unknown = null;

  if (briqApiKey && briqAppId) {
    try {
      const response = await fetch('https://karibu.briq.tz/v1/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': briqApiKey,
        },
        body: JSON.stringify({
          phone_number: profile.phone,
          message: message,
          app_key: briqAppId,
        }),
      });

      providerResponse = await response.json();
      status = response.ok ? 'sent' : 'failed';
      console.log('Briq SMS response:', response.status, providerResponse);
    } catch (error) {
      console.error('Briq SMS error:', error);
      status = 'failed';
      providerResponse = { error: String(error) };
    }
  } else {
    console.log('Briq not configured, skipping SMS');
    status = 'skipped';
  }

  await adminClient
    .from('vendor_notifications_log')
    .insert({
      order_id: order.id as string,
      vendor_id: vendorId,
      notification_type: 'sms',
      recipient_phone: profile.phone,
      message_content: message,
      provider: 'briq',
      provider_response: providerResponse,
      status: status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });

  if (status === 'sent') {
    await adminClient
      .from('orders')
      .update({
        vendor_notified_at: new Date().toISOString(),
        status: 'vendor_notified',
      })
      .eq('id', order.id as string);
  }
}
