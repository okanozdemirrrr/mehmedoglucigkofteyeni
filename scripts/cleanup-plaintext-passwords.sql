-- Manuel güvenlik temizliği (gerekirse Supabase SQL Editor'de çalıştırın)
-- Bu proje şifreyi profiles'a yazmaz; yine de eski denemelerden kolon kalmış olabilir.

-- 1) profiles üzerinde düz metin şifre kolonunu düşür
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS password;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS password_plain;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS plain_password;

-- 2) Eski dealer_applications tablosu varsa
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dealer_applications'
  ) THEN
    EXECUTE 'ALTER TABLE public.dealer_applications DROP COLUMN IF EXISTS password';
    EXECUTE 'ALTER TABLE public.dealer_applications DROP COLUMN IF EXISTS password_plain';
  END IF;
END;
$$;

-- 3) raw_user_meta_data içinde yanlışlıkla password anahtarı varsa temizle (Auth hash'e dokunmaz)
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'password' - 'password_plain'
WHERE raw_user_meta_data ? 'password'
   OR raw_user_meta_data ? 'password_plain';

-- Doğrulama
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'dealer_applications')
  AND column_name ILIKE '%pass%';
-- Beklenen: 0 satır
