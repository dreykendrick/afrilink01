-- Revoke client ability to update sensitive verification fields directly
REVOKE UPDATE (email_verified, phone_verified, photo_verified, verification_status) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (verification_status) ON public.vendor_profiles FROM anon, authenticated;

-- Create function to handle email confirmation sync from auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmation_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to run the sync
DROP TRIGGER IF EXISTS on_auth_user_updated_sync_email ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync_email
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_email_confirmation_sync();

-- Update handle_new_user trigger function to populate email_verified on initial insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_full_name text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  -- Insert profile with initial email_verified value
  INSERT INTO public.profiles (id, email, full_name, email_verified)
  VALUES (NEW.id, NEW.email, v_full_name, NEW.email_confirmed_at IS NOT NULL)
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'vendor')::public.app_role;
  EXCEPTION WHEN others THEN
    v_role := 'vendor'::public.app_role;
  END;

  IF v_role = 'admin'::public.app_role THEN
    v_role := 'vendor'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.applications (user_id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, v_full_name, v_role, 'pending');

  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Update existing profiles to match their auth.users status
UPDATE public.profiles p
SET email_verified = (u.email_confirmed_at IS NOT NULL)
FROM auth.users u
WHERE p.id = u.id;
