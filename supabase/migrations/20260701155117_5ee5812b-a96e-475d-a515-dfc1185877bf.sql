CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.app_role;
  v_full_name text;
BEGIN
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name)
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'vendor')::public.app_role;
  EXCEPTION WHEN others THEN
    v_role := 'vendor'::public.app_role;
  END;

  -- Never allow self-assigning admin via signup metadata
  IF v_role = 'admin'::public.app_role THEN
    v_role := 'vendor'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.applications (user_id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, v_full_name, v_role::text, 'pending')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();