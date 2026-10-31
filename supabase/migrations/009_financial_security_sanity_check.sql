-- =============================================================================
-- MIGRATION 009: B2B Finansal Güvenlik ve Mantık Kontrolü (Sanity Check)
-- 1. create_dealer_order: Sunucu tarafı zorunlu fiyat hesaplama (Frontend verisi yoksayılır)
-- 2. on_order_delivered_create_debt: Mükerrer borç kaydı engeli & transactions UNIQUE kısıtı
-- 3. approve_return_request: Güncel fiyat yerine order_items geçmiş satın alma fiyatı
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. BACKEND FIYAT GÜVENLİĞİ (create_dealer_order)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_dealer_order(
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id   UUID;
  v_order_id    UUID;
  v_item        JSONB;
  v_product_id  UUID;
  v_quantity    INTEGER;
  v_unit_price  NUMERIC(12, 2);
  v_modifiers   JSONB;
  v_total       NUMERIC(12, 2) := 0;
BEGIN
  -- Bayi kimlik ve yetki doğrulaması
  v_dealer_id := public.get_my_dealer_id();

  IF public.get_my_role() IS DISTINCT FROM 'DEALER' OR v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca onaylı bayiler sipariş verebilir.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sepet boş, sipariş oluşturulamaz.';
  END IF;

  -- Siparişi başlangıçta toplam tutarı 0 olarak oluştur
  INSERT INTO public.orders (dealer_id, total_amount, status)
  VALUES (v_dealer_id, 0, 'PENDING')
  RETURNING id INTO v_order_id;

  -- Her sepet kalemini işle
  -- DİKKAT: Frontend'den gelebilecek birim fiyat veya satır toplamı KESİNLİKLE dikkate alınmaz.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := COALESCE((v_item->>'quantity')::INTEGER, 0);
    v_modifiers  := COALESCE(v_item->'selected_modifiers', '{}'::jsonb);

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Geçersiz ürün ID.';
    END IF;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Ürün adedi 1 veya daha büyük olmalıdır.';
    END IF;

    -- 1. ADIM: Bayiye özel tanımlanmış bir fiyat var mı?
    SELECT custom_price INTO v_unit_price
    FROM public.dealer_prices
    WHERE dealer_id = v_dealer_id AND product_id = v_product_id;

    -- 2. ADIM: Özel fiyat yoksa, ürünün standart taban fiyatını (base_price) çek
    IF v_unit_price IS NULL THEN
      SELECT base_price INTO v_unit_price
      FROM public.products
      WHERE id = v_product_id AND is_active = true;
    END IF;

    -- Ürün sistemde aktif değilse veya bulunamadıysa siparişi iptal et
    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'Ürün bulunamadı veya satışa kapalı: %', v_product_id;
    END IF;

    -- Sipariş kalemini sunucu tarafında hesaplanan güvenli fiyatla ekle
    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      selected_modifiers_jsonb
    ) VALUES (
      v_order_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_modifiers
    );

    -- Güvenli toplamı hesapla
    v_total := v_total + (v_unit_price * v_quantity);
  END LOOP;

  -- Siparişin nihai toplam tutarını güncelle
  UPDATE public.orders
  SET total_amount = v_total
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. MÜKERRER BORÇLANDIRMA ENGELİ (Index & Trigger)
-- ---------------------------------------------------------------------------

-- transactions tablosunda sipariş bazlı mükerrer borç kaydını engelleyen UNIQUE INDEX
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_order_debt
  ON public.transactions (order_id)
  WHERE transaction_type = 'DEBT' AND order_id IS NOT NULL;

-- Trigger Fonksiyonu Güncellemesi
CREATE OR REPLACE FUNCTION public.on_order_delivered_create_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sipariş durumu DELIVERED yapıldığında ve tutar 0'dan büyükse
  IF NEW.status = 'DELIVERED'
     AND (OLD.status IS DISTINCT FROM 'DELIVERED')
     AND NEW.total_amount > 0
  THEN
    -- 1. Aşama Koruma: IF NOT EXISTS kontrolü
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions
      WHERE order_id = NEW.id AND transaction_type = 'DEBT'
    ) THEN
      BEGIN
        -- 2. Aşama Koruma: Veritabanı UNIQUE INDEX + exception yakalama
        INSERT INTO public.transactions (
          dealer_id,
          transaction_type,
          amount,
          description,
          order_id
        ) VALUES (
          NEW.dealer_id,
          'DEBT',
          NEW.total_amount,
          'Sipariş teslimi - #' || LEFT(NEW.id::text, 8),
          NEW.id
        );
      EXCEPTION
        WHEN unique_violation THEN
          -- Eşzamanlı (concurrency) iki istek aynı anda gelirse çift kaydı sessizce yut
          NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger'ın bağlı olduğundan emin ol
DROP TRIGGER IF EXISTS trigger_order_delivered_debt ON public.orders;
CREATE TRIGGER trigger_order_delivered_debt
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.on_order_delivered_create_debt();

-- ---------------------------------------------------------------------------
-- 3. GEÇMİŞE DÖNÜK İADE HESAPLAMA (approve_return_request)
-- ---------------------------------------------------------------------------

-- return_requests tablosuna opsiyonel order_id sütunu ekleme (varsa es geçilir)
ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.approve_return_request(p_return_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         public.return_requests%ROWTYPE;
  v_unit_price  NUMERIC(12, 2);
  v_amount      NUMERIC(12, 2);
  v_tx_id       UUID;
BEGIN
  -- Yetki kontrolü (Yalnızca ADMIN onaylayabilir)
  IF public.get_my_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca dağıtıcı yönetici iade onaylayabilir.';
  END IF;

  -- İade talebini satır kilidi ile seç
  SELECT * INTO v_req
  FROM public.return_requests
  WHERE id = p_return_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İade talebi bulunamadı: %', p_return_id;
  END IF;

  IF v_req.status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'Bu talep zaten daha önce işlenmiş (Statü: %)', v_req.status;
  END IF;

  -- =========================================================================
  -- GEÇMİŞ SATIN ALMA FİYATINI order_items TABLOSUNDAN ALMA MANTIĞI
  -- (Kesinlikle güncel liste/özel fiyat kullanılmaz!)
  -- =========================================================================

  -- 1) Eğer iade talebinde doğrudan bir sipariş (order_id) belirtilmişse o sipariş kaleminin fiyatı:
  IF v_req.order_id IS NOT NULL THEN
    SELECT oi.unit_price INTO v_unit_price
    FROM public.order_items oi
    WHERE oi.order_id = v_req.order_id
      AND (
        (v_req.product_id IS NOT NULL AND oi.product_id = v_req.product_id)
        OR
        (v_req.product_id IS NULL AND EXISTS (
          SELECT 1 FROM public.products p WHERE p.id = oi.product_id AND p.name = v_req.product_name
        ))
      )
    LIMIT 1;
  END IF;

  -- 2) İade talebinde order_id yoksa, bayinin geçmişte teslim edilmiş (DELIVERED) siparişlerindeki son alış fiyatı:
  IF v_unit_price IS NULL THEN
    SELECT oi.unit_price INTO v_unit_price
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.dealer_id = v_req.dealer_id
      AND o.status = 'DELIVERED'
      AND (
        (v_req.product_id IS NOT NULL AND oi.product_id = v_req.product_id)
        OR
        (v_req.product_id IS NULL AND EXISTS (
          SELECT 1 FROM public.products p WHERE p.id = oi.product_id AND p.name = v_req.product_name
        ))
      )
    ORDER BY o.created_at DESC
    LIMIT 1;
  END IF;

  -- 3) Henüz DELIVERED statüsüne geçmemiş ama bayinin verdiği geçmiş herhangi bir sipariş varsa:
  IF v_unit_price IS NULL THEN
    SELECT oi.unit_price INTO v_unit_price
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.dealer_id = v_req.dealer_id
      AND (
        (v_req.product_id IS NOT NULL AND oi.product_id = v_req.product_id)
        OR
        (v_req.product_id IS NULL AND EXISTS (
          SELECT 1 FROM public.products p WHERE p.id = oi.product_id AND p.name = v_req.product_name
        ))
      )
    ORDER BY o.created_at DESC
    LIMIT 1;
  END IF;

  -- Geçmiş siparişlerde satın alma kaydı yoksa işlemi durdur (Güncel fiyat KULLANILMAZ)
  IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
    RAISE EXCEPTION 'Bu bayinin geçmiş sipariş kayıtlarında (order_items) "%" ürünü için satın alma fiyatı bulunamadı.', v_req.product_name;
  END IF;

  -- İade tutarını hesapla
  v_amount := ROUND(v_unit_price * v_req.quantity, 2);

  -- İade talebini onayla
  UPDATE public.return_requests
  SET status = 'APPROVED'
  WHERE id = p_return_id;

  -- Cari hesaba RECEIPT (alacak / borç düşümü) olarak işle
  INSERT INTO public.transactions (
    dealer_id,
    transaction_type,
    amount,
    description
  ) VALUES (
    v_req.dealer_id,
    'RECEIPT',
    v_amount,
    'İade onayı - ' || v_req.product_name || ' x' || v_req.quantity ||
    ' (Birim Alış: ' || v_unit_price::text || ' ₺, Sebep: ' || v_req.reason || ')'
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- İzinleri tazele
GRANT EXECUTE ON FUNCTION public.create_dealer_order(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_return_request(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
