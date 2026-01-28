-- Create function to generate notifications for product status changes
CREATE OR REPLACE FUNCTION public.notify_product_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger on status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.vendor_id,
        'Product Approved! 🎉',
        'Your product "' || NEW.title || '" has been approved and is now live in the marketplace.',
        'success'
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.vendor_id,
        'Product Rejected',
        'Your product "' || NEW.title || '" was not approved. Please review and resubmit.',
        'error'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for product status changes
CREATE TRIGGER on_product_status_change
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_product_status_change();

-- Create function to notify vendors about new orders
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_id uuid;
  product_title text;
  item record;
BEGIN
  -- For each item in the order, notify the vendor
  FOR item IN 
    SELECT oi.product_id, p.vendor_id, p.title
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      item.vendor_id,
      'New Order! 🛒',
      'You have a new order for "' || item.title || '" from ' || NEW.customer_name || '.',
      'success'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Create trigger for new orders
CREATE TRIGGER on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

-- Create function to notify affiliates about conversions
CREATE OR REPLACE FUNCTION public.notify_affiliate_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affiliate_user_id uuid;
  commission integer;
BEGIN
  IF NEW.affiliate_link_id IS NOT NULL THEN
    -- Get affiliate info
    SELECT al.affiliate_id, oi.commission_amount
    INTO affiliate_user_id, commission
    FROM public.affiliate_links al
    JOIN public.order_items oi ON oi.order_id = NEW.id
    WHERE al.id = NEW.affiliate_link_id
    LIMIT 1;

    IF affiliate_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        affiliate_user_id,
        'Commission Earned! 💰',
        'You earned a commission from a sale! Check your dashboard for details.',
        'success'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for affiliate conversions
CREATE TRIGGER on_affiliate_conversion
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.affiliate_link_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_affiliate_conversion();

-- Create function to notify about withdrawal status changes
CREATE OR REPLACE FUNCTION public.notify_withdrawal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'Withdrawal Approved! ✅',
        'Your withdrawal request for $' || (NEW.amount / 100.0)::text || ' has been approved and is being processed.',
        'success'
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'Withdrawal Rejected',
        'Your withdrawal request was rejected. Please contact support for more information.',
        'error'
      );
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'Payment Sent! 🎉',
        'Your withdrawal of $' || (NEW.amount / 100.0)::text || ' has been sent to your account.',
        'success'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for withdrawal status changes
CREATE TRIGGER on_withdrawal_status_change
  AFTER UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_withdrawal_status();