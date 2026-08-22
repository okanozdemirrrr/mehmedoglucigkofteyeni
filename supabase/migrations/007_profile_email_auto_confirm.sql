-- =============================================================================
-- profiles.email + başvuru kullanıcılarında e-posta otomatik onay
-- (Supabase "Confirm email" açıkken Invalid login credentials hatasını önler)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Mevcut auth kullanıcılarından e-posta doldur
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- handle_new_user: email alanını da yaz
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

  IF v_role = 'ADMIN' THEN
    v_status := 'APPROVED';
  ELSIF v_dealer_id IS NOT NULL THEN
    v_status := 'APPROVED';
  ELSE
    v_status := 'PENDING';
  END IF;

  IF v_role = 'DEALER' AND v_dealer_id IS NULL AND v_status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'DEALER kullanıcısı için dealer_id zorunludur (veya status=PENDING başvuru).';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, role, dealer_id,
    age, city, district, tax_no, phone, email, status
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
    NEW.email,
    v_status
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profil oluşturulamadı: %', SQLERRM;
END;
$$;

-- Yeni kayıtlarda e-postayı otomatik onaylı say (B2B manuel onay zaten var)
CREATE OR REPLACE FUNCTION public.auto_confirm_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_auth_user();

-- Mevcut onaylanmamış hesapları onayla (okan44@gmail.com dahil)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

NOTIFY pgrst, 'reload schema';
