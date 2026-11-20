-- =============================================================================
-- Ürün görselleri: products.image_url + public read / admin write storage
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Public bucket (vitrin girişsiz okuyacak)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Eski politikaları temizle (idempotent)
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "product_images_anon_no_write" ON storage.objects;

-- Herkes okuyabilir (anon + authenticated)
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- Sadece ADMIN yazabilir
CREATE POLICY "product_images_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.get_my_role() = 'ADMIN'
  );

CREATE POLICY "product_images_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.get_my_role() = 'ADMIN'
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.get_my_role() = 'ADMIN'
  );

CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.get_my_role() = 'ADMIN'
  );

-- Vitrin RPC: image_url zaten vardı; yeniden tanımla (fiyat yok)
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
    COALESCE(p.catalog_sort, 0) AS catalog_sort
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.is_active = true
  ORDER BY
    COALESCE(c.sort_order, 9999),
    COALESCE(p.catalog_sort, 0),
    p.name;
$$;

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
    COALESCE(p.catalog_sort, 0) AS catalog_sort
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.is_active = true
    AND p.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.list_public_products() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_product(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_products() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_product(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
