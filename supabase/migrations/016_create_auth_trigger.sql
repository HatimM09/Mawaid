DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Auto-create user_stats entry when a new user signs up via Supabase Auth
-- Replaces Firebase Cloud Function `beforeUserCreated`

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'display_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'member')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE user_stats.name END;
  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
