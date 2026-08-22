-- =============================================================================
-- MEHMEDOĞLU ÇİĞKÖFTE - Kategori / Menü Mimarisi
-- Supabase Dashboard → SQL Editor → Run
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_authenticated" ON public.categories;
CREATE POLICY "categories_select_authenticated"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
CREATE POLICY "categories_insert_admin"
  ON public.categories FOR INSERT
  WITH CHECK (public.get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
CREATE POLICY "categories_update_admin"
  ON public.categories FOR UPDATE
  USING (public.get_my_role() = 'ADMIN');

DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;
CREATE POLICY "categories_delete_admin"
  ON public.categories FOR DELETE
  USING (public.get_my_role() = 'ADMIN');

INSERT INTO public.categories (name, sort_order) VALUES
  ('Çiğköfte', 1),
  ('Lavaş', 2),
  ('İçecekler', 3)
ON CONFLICT (name) DO NOTHING;

UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND c.name = 'Çiğköfte'
  AND p.name ILIKE '%çiğköfte%';

UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND c.name = 'Lavaş'
  AND p.name ILIKE '%lavaş%';

UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND c.name = 'İçecekler'
  AND p.name ILIKE '%içecek%';

NOTIFY pgrst, 'reload schema';
