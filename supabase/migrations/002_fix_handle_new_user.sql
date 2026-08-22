-- =============================================================================
-- FIX: Kullanıcı oluşturma hatası (profiles CHECK constraint)
-- Supabase SQL Editor'da bu dosyayı çalıştırın.
-- =============================================================================

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
BEGIN
  v_role_text := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  BEGIN
    v_dealer_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'dealer_id', '')), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_dealer_id := NULL;
  END;

  IF v_role_text = 'ADMIN' THEN
    v_role := 'ADMIN';
  ELSIF v_role_text = 'DEALER' THEN
    v_role := 'DEALER';
  ELSIF v_dealer_id IS NOT NULL THEN
    v_role := 'DEALER';
  ELSE
    -- Dashboard'dan metadata olmadan oluşturulan ilk kullanıcı = Admin
    v_role := 'ADMIN';
  END IF;

  IF v_role = 'DEALER' AND v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'DEALER kullanıcısı için User Metadata içinde dealer_id zorunludur. Örnek: {"role":"DEALER","full_name":"Bayi Adı","dealer_id":"a0000000-0000-4000-8000-000000000001"}';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, dealer_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    v_role,
    CASE WHEN v_role = 'ADMIN' THEN NULL ELSE v_dealer_id END
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profil oluşturulamadı: %', SQLERRM;
END;
$$;

-- Trigger zaten varsa yeniden oluşturmaya gerek yok; fonksiyon güncellendi.
