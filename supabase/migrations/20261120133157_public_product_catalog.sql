-- =============================================================================
-- App Store: girişsiz ürün vitrini (fiyat / iş verisi sızdırmaz)
-- Anon rolüne products tablosu AÇILMAZ; sadece güvenli RPC.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS catalog_sort INTEGER NOT NULL DEFAULT 0;

-- Mevcut aktif ürünlere kısa vitrin açıklaması (yoksa)
UPDATE public.products
SET description = COALESCE(
  NULLIF(TRIM(description), ''),
  CASE
    WHEN name ILIKE '%çiğköfte%' THEN 'Taze hazırlanan klasik çiğköfte.'
    WHEN name ILIKE '%dürüm%' THEN 'Lavaş ile servis edilen çiğköfte dürüm.'
    WHEN name ILIKE '%lavaş%' THEN 'Siparişler için taze lavaş.'
    WHEN name ILIKE '%ayran%' THEN 'Soğuk servis ayran.'
    WHEN name ILIKE '%şalgam%' THEN 'Geleneksel şalgam suyu.'
    ELSE 'Mehmedoğlu ürün gamından.'
  END
)
WHERE is_active = true;

-- Güvenli katalog listesi (fiyat / modifiers / maliyet YOK)
CREATE OR REPLACE FUNCTION public.list_public_products()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  image_url TEXT,
  category_id UUID,
  category_name TEXT,
  catalog_sort INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    COALESCE(NULLIF(TRIM(p.description), ''), 'Mehmedoğlu ürün gamından.') AS description,
    NULLIF(TRIM(p.image_url), '') AS image_url,
    p.category_id,
    c.name AS category_name,
    p.catalog_sort
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.is_active = true
  ORDER BY
    COALESCE(c.sort_order, 9999),
    p.catalog_sort,
    p.name;
$$;

-- Tek ürün detayı
CREATE OR REPLACE FUNCTION public.get_public_product(p_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  image_url TEXT,
  category_id UUID,
  category_name TEXT,
  catalog_sort INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    COALESCE(NULLIF(TRIM(p.description), ''), 'Mehmedoğlu ürün gamından.') AS description,
    NULLIF(TRIM(p.image_url), '') AS image_url,
    p.category_id,
    c.name AS category_name,
    p.catalog_sort
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.is_active = true
    AND p.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.list_public_products() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_product(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_products() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_product(UUID) TO anon, authenticated;

-- products / categories / dealer_prices anon SELECT yok (mevcut RLS korunur)
-- Explicit: anon için SELECT policy eklenmez.

NOTIFY pgrst, 'reload schema';
