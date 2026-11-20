-- Apple 5.1.1(v): hesap silme + anonimleştirme + demo hesap koruması

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- Seed / service_role profil güncellemesine izin ver
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_dealer_id UUID;
  v_is_demo BOOLEAN;
  v_other_profiles INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT dealer_id, COALESCE(is_demo, false)
    INTO v_dealer_id, v_is_demo
  FROM public.profiles
  WHERE id = v_uid;

  IF v_is_demo
     OR lower(COALESCE(v_email, '')) IN (
       'review-admin@regonteknoloji.com',
       'review-bayi@regonteknoloji.com'
     )
  THEN
    RAISE EXCEPTION 'Demo / inceleme hesapları silinemez';
  END IF;

  -- Push + bildirim kişisel verileri
  DELETE FROM public.user_push_tokens WHERE user_id = v_uid;
  DELETE FROM public.notifications WHERE user_id = v_uid;

  -- Muhasebe kayıtları kalsın; bayi kişisel alanlarını anonimleştir
  IF v_dealer_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_other_profiles
    FROM public.profiles
    WHERE dealer_id = v_dealer_id AND id <> v_uid;

    IF v_other_profiles = 0 THEN
      UPDATE public.dealers
      SET
        name = 'Silinen Bayi',
        phone = NULL,
        tax_no = NULL,
        address = NULL
      WHERE id = v_dealer_id;
    END IF;
  END IF;

  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

NOTIFY pgrst, 'reload schema';
