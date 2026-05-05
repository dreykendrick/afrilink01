-- 1) Idempotent atomic delivery confirmation + token-scoped anonymous order lookup
CREATE OR REPLACE FUNCTION public.get_order_by_token(p_order_id uuid, p_token text)
RETURNS TABLE (
  id uuid,
  status text,
  total_amount numeric,
  affiliate_link_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.status, o.total_amount, o.affiliate_link_id, o.created_at
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.confirmation_token = p_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_order_items_by_token(p_order_id uuid, p_token text)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  quantity integer,
  price numeric,
  commission_amount numeric,
  product_title text,
  vendor_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.id, oi.product_id, oi.quantity, oi.price, oi.commission_amount,
         p.title AS product_title, p.vendor_id
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id
    AND o.confirmation_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.confirm_delivery_with_token(p_order_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_total_commission numeric := 0;
  v_link RECORD;
  v_item RECORD;
  v_vendor_id uuid;
  v_vendor_amount numeric;
BEGIN
  -- Lock and validate order
  SELECT id, status, affiliate_link_id, confirmation_token
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.confirmation_token IS NULL OR v_order.confirmation_token <> p_token THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  -- Idempotency: if already confirmed, return success without re-crediting
  IF v_order.status = 'delivered_confirmed' THEN
    RETURN jsonb_build_object('success', true, 'already_confirmed', true);
  END IF;

  -- Affiliate commission release
  IF v_order.affiliate_link_id IS NOT NULL THEN
    SELECT COALESCE(SUM(oi.commission_amount * oi.quantity), 0)
    INTO v_total_commission
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id;

    IF v_total_commission > 0 THEN
      SELECT id, affiliate_id, commission_earned
      INTO v_link
      FROM public.affiliate_links
      WHERE id = v_order.affiliate_link_id
      FOR UPDATE;

      IF FOUND THEN
        UPDATE public.affiliate_links
        SET commission_earned = COALESCE(commission_earned, 0) + v_total_commission
        WHERE id = v_link.id;

        UPDATE public.profiles
        SET wallet_balance = COALESCE(wallet_balance, 0) + v_total_commission
        WHERE id = v_link.affiliate_id;

        INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
        VALUES (
          v_link.affiliate_id,
          'commission',
          v_total_commission,
          'Commission released for order #' || substr(v_order.id::text, 1, 8),
          v_order.id
        );
      END IF;
    END IF;
  END IF;

  -- Vendor payouts (per vendor aggregation)
  FOR v_item IN
    SELECT p.vendor_id,
           SUM(oi.price * oi.quantity - oi.commission_amount * oi.quantity) AS amount
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id
    GROUP BY p.vendor_id
  LOOP
    v_vendor_id := v_item.vendor_id;
    v_vendor_amount := v_item.amount;

    IF v_vendor_id IS NOT NULL AND v_vendor_amount > 0 THEN
      UPDATE public.profiles
      SET wallet_balance = COALESCE(wallet_balance, 0) + v_vendor_amount
      WHERE id = v_vendor_id;

      INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
      VALUES (
        v_vendor_id,
        'sale',
        v_vendor_amount,
        'Payout released for order #' || substr(v_order.id::text, 1, 8),
        v_order.id
      );
    END IF;
  END LOOP;

  UPDATE public.orders
  SET status = 'delivered_confirmed'
  WHERE id = v_order.id;

  RETURN jsonb_build_object('success', true, 'already_confirmed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_delivery_issue_with_token(p_order_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'delivery_issue'
  WHERE id = p_order_id
    AND confirmation_token = p_token
    AND status NOT IN ('delivered_confirmed', 'delivery_issue');

  IF NOT FOUND THEN
    -- Either invalid token or already in a final state; verify token exists
    IF NOT EXISTS (
      SELECT 1 FROM public.orders WHERE id = p_order_id AND confirmation_token = p_token
    ) THEN
      RAISE EXCEPTION 'invalid_token';
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Restrict execute: only anon + authenticated may call the token-scoped helpers
REVOKE ALL ON FUNCTION public.get_order_by_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_order_items_by_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_delivery_with_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_delivery_issue_with_token(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_order_by_token(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_items_by_token(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_with_token(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_delivery_issue_with_token(uuid, text) TO anon, authenticated;

-- 2) Tighten verification-photos storage: ensure bucket is private and restrict listing
UPDATE storage.buckets SET public = false WHERE id = 'verification-photos';
