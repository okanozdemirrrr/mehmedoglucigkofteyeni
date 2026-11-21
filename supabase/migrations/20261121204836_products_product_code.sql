-- Ürün kodu: URN-0001 formatı, benzersiz, otomatik, değişmez
-- Mevcut ürünlere backfill; eşzamanlı insert'lerde sequence ile çakışma olmaz.

CREATE SEQUENCE IF NOT EXISTS public.product_code_seq;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_code TEXT;

-- Sequence'i mevcut en yüksek URN numarasına hizala
SELECT setval(
  'public.product_code_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX(
          CASE
            WHEN product_code ~ '^URN-[0-9]+$'
              THEN NULLIF(regexp_replace(product_code, '^URN-', ''), '')::INTEGER
            ELSE NULL
          END
        )
        FROM public.products
        WHERE product_code IS NOT NULL
      ),
      0
    ),
    0
  ),
  true
);

-- Boş kodlu ürünlere sırayla kod ata
WITH ordered AS (
  SELECT
    id,
    'URN-' || lpad(nextval('public.product_code_seq')::text, 4, '0') AS code
  FROM public.products
  WHERE product_code IS NULL OR btrim(product_code) = ''
  ORDER BY created_at NULLS LAST, id
)
UPDATE public.products p
SET product_code = o.code
FROM ordered o
WHERE p.id = o.id;

ALTER TABLE public.products
  ALTER COLUMN product_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_product_code_key'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_code_key UNIQUE (product_code);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_product_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_code IS NULL OR btrim(NEW.product_code) = '' THEN
    NEW.product_code := 'URN-' || lpad(nextval('public.product_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_product_code ON public.products;
CREATE TRIGGER trg_assign_product_code
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_product_code();

CREATE OR REPLACE FUNCTION public.guard_product_code_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_code IS DISTINCT FROM OLD.product_code THEN
    RAISE EXCEPTION 'Ürün kodu değiştirilemez';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_product_code ON public.products;
CREATE TRIGGER trg_guard_product_code
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_product_code_immutable();

COMMENT ON COLUMN public.products.product_code IS 'Otomatik URN-#### kodu; unique, immutable';
