-- Bayi başvuru bildirimi metni + kişisel alan / şifre güvenliği
-- Şifre asla uygulama tablolarında tutulmaz; yalnızca Supabase Auth hash'ler.

-- Eski hatalı düz metin şifre kolonları varsa temizle (yoksa no-op)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN password;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password_plain'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN password_plain;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dealer_applications'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dealer_applications' AND column_name = 'password'
  ) THEN
    ALTER TABLE public.dealer_applications DROP COLUMN password;
  END IF;
END;
$$;

-- Anon profiles okuyamasın (başvuru Auth signUp + handle_new_user trigger ile gelir)
REVOKE ALL ON TABLE public.profiles FROM anon;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "profiles_anon_no_select" ON public.profiles;
CREATE POLICY "profiles_anon_no_select"
  ON public.profiles FOR SELECT
  TO anon
  USING (false);

-- Yeni bayi başvurusu → admin zil + toast + push (notify_all_admins mevcut yol)
CREATE OR REPLACE FUNCTION public.notify_on_dealer_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_city TEXT;
  v_district TEXT;
  v_title TEXT;
BEGIN
  IF NEW.role = 'DEALER' AND NEW.status = 'PENDING' THEN
    v_name := COALESCE(NULLIF(TRIM(NEW.full_name), ''), 'Yeni başvuru');
    v_city := COALESCE(NULLIF(TRIM(NEW.city), ''), '—');
    v_district := COALESCE(NULLIF(TRIM(NEW.district), ''), '—');
    v_title := 'Yeni Bayi Başvurusu: ' || v_name || ' (' || v_city || '/' || v_district || ')';

    PERFORM public.notify_all_admins(
      v_title,
      v_name || ' onayınızı bekliyor.',
      'dealer_application',
      jsonb_build_object(
        'profile_id', NEW.id,
        'full_name', v_name,
        'city', v_city,
        'district', v_district
      ),
      '/admin/basvurular'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_dealer_application ON public.profiles;
CREATE TRIGGER trg_notify_on_dealer_application
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_dealer_application();
