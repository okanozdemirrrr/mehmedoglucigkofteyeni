-- =============================================================================
-- Fix: "Yeni Sipariş Geldi!" bildiriminde ₺0,00
-- Kök neden: orders INSERT total_amount=0 iken AFTER INSERT trigger bildirimi
-- üretiyordu; tutar create_dealer_order sonunda UPDATE ile yazılıyordu.
-- Çözüm: INSERT bildirimi kaldır; RPC sonunda gerçek tutarla tek bildirim.
-- =============================================================================

-- 1) Trigger: yalnızca status değişiminde (bayiye) bildir; INSERT'te admin bildirimi YOK
CREATE OR REPLACE FUNCTION public.notify_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data JSONB;
BEGIN
  v_data := jsonb_build_object(
    'order_id', NEW.id,
    'dealer_id', NEW.dealer_id,
    'status', NEW.status::TEXT,
    'total_amount', NEW.total_amount
  );

  -- Yeni sipariş admin bildirimi create_dealer_order içinde (toplam yazıldıktan sonra)
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'PREPARING' THEN
      PERFORM public.notify_dealer_users(
        NEW.dealer_id,
        'Siparişiniz Onaylandı ve Hazırlanıyor 👨‍🍳',
        'Siparişiniz onaylandı, hazırlık aşamasına alındı.',
        'order_preparing',
        v_data,
        '/bayi/dashboard'
      );
    ELSIF NEW.status = 'ON_THE_WAY' THEN
      PERFORM public.notify_dealer_users(
        NEW.dealer_id,
        'Ürününüz Yola Çıktı! 🚚',
        'Siparişiniz dağıtıma çıkarıldı, adresinize doğru geliyor.',
        'order_shipped',
        v_data,
        '/bayi/dashboard'
      );
    ELSIF NEW.status = 'DELIVERED' THEN
      PERFORM public.notify_dealer_users(
        NEW.dealer_id,
        'Siparişiniz teslim edildi',
        'Siparişiniz teslim edildi. Bereketli olsun!',
        'order_delivered',
        v_data,
        '/bayi/dashboard'
      );
    ELSIF NEW.status::TEXT = 'CANCELLED' THEN
      PERFORM public.notify_dealer_users(
        NEW.dealer_id,
        'Sipariş durumu güncellendi',
        'Siparişinizle ilgili durum güncellemesi: İptal Edildi.',
        'order_cancelled',
        v_data,
        '/bayi/dashboard'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_order_change ON public.orders;
CREATE TRIGGER trg_notify_on_order_change
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_change();

-- 2) create_dealer_order: kalemler + toplam yazıldıktan sonra tek admin bildirimi
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
  v_dealer_name TEXT;
  v_amount      TEXT;
  v_data        JSONB;
BEGIN
  v_dealer_id := public.get_my_dealer_id();

  IF public.get_my_role() IS DISTINCT FROM 'DEALER' OR v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca onaylı bayiler sipariş verebilir.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sepet boş, sipariş oluşturulamaz.';
  END IF;

  INSERT INTO public.orders (dealer_id, total_amount, status)
  VALUES (v_dealer_id, 0, 'PENDING')
  RETURNING id INTO v_order_id;

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

    SELECT custom_price INTO v_unit_price
    FROM public.dealer_prices
    WHERE dealer_id = v_dealer_id AND product_id = v_product_id;

    IF v_unit_price IS NULL THEN
      SELECT base_price INTO v_unit_price
      FROM public.products
      WHERE id = v_product_id AND is_active = true;
    END IF;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'Ürün bulunamadı veya satışa kapalı: %', v_product_id;
    END IF;

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

    v_total := v_total + (v_unit_price * v_quantity);
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sipariş tutarı sıfır olamaz.';
  END IF;

  UPDATE public.orders
  SET total_amount = v_total
  WHERE id = v_order_id;

  -- Tek admin bildirimi (gerçek tutar + TR format)
  SELECT COALESCE(name, 'Bayi') INTO v_dealer_name
  FROM public.dealers WHERE id = v_dealer_id;

  v_amount := replace(to_char(v_total, 'FM999999990.00'), '.', ',');
  v_data := jsonb_build_object(
    'order_id', v_order_id,
    'dealer_id', v_dealer_id,
    'status', 'PENDING',
    'total_amount', v_total
  );

  PERFORM public.notify_all_admins(
    'Yeni Sipariş Geldi!',
    v_dealer_name || ' - ₺' || v_amount || ' tutarında sipariş oluşturdu.',
    'new_order',
    v_data,
    '/admin/dashboard'
  );

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_dealer_order(JSONB) TO authenticated;

-- 3) Tek seferlik: eski ₺0,00 new_order bildirim metinlerini gerçek tutarla düzelt
UPDATE public.notifications n
SET
  body = COALESCE(d.name, 'Bayi')
    || ' - ₺'
    || replace(to_char(o.total_amount, 'FM999999990.00'), '.', ',')
    || ' tutarında sipariş oluşturdu.',
  data = COALESCE(n.data, '{}'::jsonb) || jsonb_build_object('total_amount', o.total_amount)
FROM public.orders o
LEFT JOIN public.dealers d ON d.id = o.dealer_id
WHERE n.type = 'new_order'
  AND n.data ? 'order_id'
  AND (n.data->>'order_id')::uuid = o.id
  AND o.total_amount > 0
  AND (
    n.body LIKE '%₺0.00%'
    OR n.body LIKE '%₺0,00%'
    OR COALESCE((n.data->>'total_amount')::numeric, 0) = 0
  );

NOTIFY pgrst, 'reload schema';
