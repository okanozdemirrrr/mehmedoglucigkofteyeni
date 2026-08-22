-- =============================================================================
-- Bayi başvuru (PENDING) mimarisi
-- Supabase SQL Editor'da çalıştırın.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: başvuru alanları
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS tax_no TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING';

UPDATE public.profiles
SET status = 'APPROVED'
WHERE role = 'ADMIN'
   OR dealer_id IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_dealer_required;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_dealer_required CHECK (
    role = 'ADMIN'
    OR dealer_id IS NOT NULL
    OR status = 'PENDING'
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED')
  );

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- ---------------------------------------------------------------------------
-- handle_new_user: PENDING bayi başvurularına izin ver
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_text TEXT;
  v_role user_role;
  v_dealer_id UUID;
  v_status TEXT;
  v_age INTEGER;
BEGIN
  v_role_text := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  v_status := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'status', '')));

  BEGIN
    v_dealer_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'dealer_id', '')), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_dealer_id := NULL;
  END;

  BEGIN
    v_age := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'age', '')), '')::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    v_age := NULL;
  END;

  IF v_role_text = 'ADMIN' THEN
    v_role := 'ADMIN';
  ELSIF v_role_text = 'DEALER' THEN
    v_role := 'DEALER';
  ELSIF v_dealer_id IS NOT NULL THEN
    v_role := 'DEALER';
  ELSE
    v_role := 'ADMIN';
  END IF;

  -- Dashboard'dan dealer_id ile açılan bayi = onaylı; başvuru = PENDING
  IF v_role = 'ADMIN' THEN
    v_status := 'APPROVED';
  ELSIF v_dealer_id IS NOT NULL THEN
    v_status := 'APPROVED';
  ELSIF v_status = 'PENDING' OR v_status = '' THEN
    v_status := 'PENDING';
  ELSE
    v_status := 'PENDING';
  END IF;

  IF v_role = 'DEALER' AND v_dealer_id IS NULL AND v_status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'DEALER kullanıcısı için dealer_id zorunludur (veya status=PENDING başvuru).';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, role, dealer_id,
    age, city, district, tax_no, phone, status
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    v_role,
    CASE WHEN v_role = 'ADMIN' THEN NULL ELSE v_dealer_id END,
    v_age,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'city', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'district', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'tax_no', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    v_status
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profil oluşturulamadı: %', SQLERRM;
END;
$$;

-- Hassas alanları kullanıcı kendi değiştiremesin
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'ADMIN' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.dealer_id IS DISTINCT FROM OLD.dealer_id THEN
      RAISE EXCEPTION 'Yetkisiz alan güncellemesi';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_fields();

-- ---------------------------------------------------------------------------
-- RPC: Bayi başvurusunu onayla → dealers kaydı + APPROVED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_dealer_application(p_profile_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_dealer_id UUID;
  v_address TEXT;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Yetkisiz işlem';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Başvuru bulunamadı';
  END IF;

  IF v_profile.role IS DISTINCT FROM 'DEALER' THEN
    RAISE EXCEPTION 'Bu profil bayi başvurusu değil';
  END IF;

  IF v_profile.status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'Başvuru zaten işlenmiş';
  END IF;

  IF v_profile.dealer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Profil zaten bir bayiye bağlı';
  END IF;

  v_address := NULLIF(
    TRIM(CONCAT_WS(' / ', NULLIF(v_profile.city, ''), NULLIF(v_profile.district, ''))),
    ''
  );

  INSERT INTO public.dealers (name, tax_no, phone, address)
  VALUES (
    v_profile.full_name,
    v_profile.tax_no,
    v_profile.phone,
    v_address
  )
  RETURNING id INTO v_dealer_id;

  UPDATE public.profiles
  SET
    dealer_id = v_dealer_id,
    status = 'APPROVED'
  WHERE id = p_profile_id;

  RETURN v_dealer_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: Bayi başvurusunu reddet → profil + auth user sil
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_dealer_application(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Yetkisiz işlem';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Başvuru bulunamadı';
  END IF;

  IF v_profile.status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'Başvuru zaten işlenmiş';
  END IF;

  DELETE FROM public.profiles WHERE id = p_profile_id;
  DELETE FROM auth.users WHERE id = p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_dealer_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_dealer_application(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
