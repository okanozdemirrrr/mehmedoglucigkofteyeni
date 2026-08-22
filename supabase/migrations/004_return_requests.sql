-- =============================================================================
-- MEHMEDOĞLU ÇİĞKÖFTE - İade / Fire Modülü
-- Supabase SQL Editor'da çalıştırın (veya migration olarak uygulayın).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM: return_status
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'return_status') THEN
    CREATE TYPE return_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TABLE: return_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.return_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id     UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  reason        TEXT NOT NULL,
  status        return_status NOT NULL DEFAULT 'PENDING',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_dealer_id ON public.return_requests(dealer_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON public.return_requests(created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_requests_select" ON public.return_requests;
CREATE POLICY "return_requests_select"
  ON public.return_requests FOR SELECT
  USING (
    public.get_my_role() = 'ADMIN'
    OR dealer_id = public.get_my_dealer_id()
  );

DROP POLICY IF EXISTS "return_requests_insert_dealer" ON public.return_requests;
CREATE POLICY "return_requests_insert_dealer"
  ON public.return_requests FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'DEALER'
    AND dealer_id = public.get_my_dealer_id()
  );

DROP POLICY IF EXISTS "return_requests_update_admin" ON public.return_requests;
CREATE POLICY "return_requests_update_admin"
  ON public.return_requests FOR UPDATE
  USING (public.get_my_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- RPC: Admin iade onayla → transactions'a RECEIPT (borç düşümü)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_return_request(p_return_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         public.return_requests%ROWTYPE;
  v_unit_price  NUMERIC;
  v_amount      NUMERIC;
  v_tx_id       UUID;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Yetkisiz işlem';
  END IF;

  SELECT * INTO v_req
  FROM public.return_requests
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İade talebi bulunamadı';
  END IF;

  IF v_req.status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'Talep zaten işlenmiş';
  END IF;

  -- Güncel fiyat: bayi özel fiyat → ürün base_price
  IF v_req.product_id IS NOT NULL THEN
    SELECT COALESCE(dp.custom_price, p.base_price)
    INTO v_unit_price
    FROM public.products p
    LEFT JOIN public.dealer_prices dp
      ON dp.product_id = p.id AND dp.dealer_id = v_req.dealer_id
    WHERE p.id = v_req.product_id;
  ELSE
    SELECT COALESCE(dp.custom_price, p.base_price)
    INTO v_unit_price
    FROM public.products p
    LEFT JOIN public.dealer_prices dp
      ON dp.product_id = p.id AND dp.dealer_id = v_req.dealer_id
    WHERE p.name = v_req.product_name
    ORDER BY p.is_active DESC
    LIMIT 1;
  END IF;

  IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
    RAISE EXCEPTION 'Ürün fiyatı bulunamadı: %', v_req.product_name;
  END IF;

  v_amount := ROUND(v_unit_price * v_req.quantity, 2);

  UPDATE public.return_requests
  SET status = 'APPROVED'
  WHERE id = p_return_id;

  INSERT INTO public.transactions (
    dealer_id,
    transaction_type,
    amount,
    description
  ) VALUES (
    v_req.dealer_id,
    'RECEIPT',
    v_amount,
    'İade onayı - ' || v_req.product_name || ' x' || v_req.quantity || ' (' || v_req.reason || ')'
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: Admin iade reddet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_return_request(p_return_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Yetkisiz işlem';
  END IF;

  UPDATE public.return_requests
  SET status = 'REJECTED'
  WHERE id = p_return_id
    AND status = 'PENDING';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'İade talebi bulunamadı veya zaten işlenmiş';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_return_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_return_request(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
