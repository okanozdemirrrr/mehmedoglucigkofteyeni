-- =============================================================================
-- products tablosu için admin DELETE politikası
-- (Siparişte kullanılan ürünler FK ile engellenir; boş ürünler silinebilir)
-- Supabase SQL Editor'da çalıştırın.
-- =============================================================================

DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE
  USING (public.get_my_role() = 'ADMIN');

NOTIFY pgrst, 'reload schema';
