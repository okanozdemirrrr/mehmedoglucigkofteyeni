-- Performans: eksik indeksler + admin KPI aggregate (tüm transactions/orders çekmeyi önler)

-- order_items.product_id (ürün silme sayımı / join)
CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items (product_id);

-- orders: status + created_at (aktif sipariş listeleri)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON public.orders (status, created_at DESC);

-- orders: dealer + created_at (bayi sipariş geçmişi)
CREATE INDEX IF NOT EXISTS idx_orders_dealer_created_at
  ON public.orders (dealer_id, created_at DESC);

-- orders: DELIVERED arşiv (updated_at filtresi)
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at
  ON public.orders (status, updated_at DESC);

-- transactions: dealer + type (bakiye aggregasyonu)
CREATE INDEX IF NOT EXISTS idx_transactions_dealer_type
  ON public.transactions (dealer_id, transaction_type);

-- products: aktif + kategori
CREATE INDEX IF NOT EXISTS idx_products_active_category
  ON public.products (is_active, category_id)
  WHERE is_active = true;

-- Admin paneli KPI: tek round-trip, sunucu tarafı aggregate
CREATE OR REPLACE FUNCTION public.admin_dashboard_kpi()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_revenue NUMERIC;
  v_pending INTEGER;
  v_balances JSONB;
  v_receivable NUMERIC;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Yetkisiz';
  END IF;

  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_revenue
  FROM public.orders
  WHERE status = 'DELIVERED';

  SELECT COUNT(*)::INTEGER
  INTO v_pending
  FROM public.orders
  WHERE status = 'PENDING';

  SELECT COALESCE(
    jsonb_object_agg(dealer_id::text, bal),
    '{}'::jsonb
  )
  INTO v_balances
  FROM (
    SELECT
      dealer_id,
      SUM(
        CASE
          WHEN transaction_type = 'DEBT' THEN amount
          ELSE -amount
        END
      ) AS bal
    FROM public.transactions
    GROUP BY dealer_id
  ) s;

  SELECT COALESCE(SUM(GREATEST(bal, 0)), 0)
  INTO v_receivable
  FROM (
    SELECT
      SUM(
        CASE
          WHEN transaction_type = 'DEBT' THEN amount
          ELSE -amount
        END
      ) AS bal
    FROM public.transactions
    GROUP BY dealer_id
  ) t;

  RETURN jsonb_build_object(
    'total_revenue', v_revenue,
    'pending_count', v_pending,
    'total_receivable', v_receivable,
    'dealer_balances', v_balances
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_kpi() TO authenticated;

COMMENT ON FUNCTION public.admin_dashboard_kpi() IS
  'Admin dashboard KPI: ciro, bekleyen sipariş, alacak, bayi bakiyeleri (tek çağrı)';

-- Örnek EXPLAIN (manuel SQL Editor):
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT status, created_at FROM public.orders
-- WHERE status IN ('PENDING','PREPARING','ON_THE_WAY')
-- ORDER BY created_at DESC LIMIT 60;
--
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT dealer_id,
--   SUM(CASE WHEN transaction_type = 'DEBT' THEN amount ELSE -amount END)
-- FROM public.transactions GROUP BY dealer_id;
