-- =============================================================================
-- Bildirim sistemi: notifications + user_push_tokens + triggerlar + realtime
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CANCELLED sipariş durumu (yoksa ekle)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'CANCELLED';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'general',
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  link         TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT: sadece SECURITY DEFINER trigger/fonksiyonlar (RLS bypass)

-- ---------------------------------------------------------------------------
-- user_push_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT,
  fcm_token    TEXT NOT NULL,
  platform     TEXT NOT NULL DEFAULT 'web',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user
  ON public.user_push_tokens (user_id);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_tokens_select_own ON public.user_push_tokens;
CREATE POLICY push_tokens_select_own ON public.user_push_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_tokens_upsert_own ON public.user_push_tokens;
CREATE POLICY push_tokens_upsert_own ON public.user_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_tokens_update_own ON public.user_push_tokens;
CREATE POLICY push_tokens_update_own ON public.user_push_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_tokens_delete_own ON public.user_push_tokens;
CREATE POLICY push_tokens_delete_own ON public.user_push_tokens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Yardımcı: bildirim ekle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'general',
  p_data JSONB DEFAULT '{}'::jsonb,
  p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, data, link)
  VALUES (p_user_id, p_title, p_body, p_type, COALESCE(p_data, '{}'::jsonb), p_link)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_all_admins(
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'general',
  p_data JSONB DEFAULT '{}'::jsonb,
  p_link TEXT DEFAULT '/admin/dashboard'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles WHERE role = 'ADMIN'
  LOOP
    PERFORM public.create_notification(r.id, p_title, p_body, p_type, p_data, p_link);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_dealer_users(
  p_dealer_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'general',
  p_data JSONB DEFAULT '{}'::jsonb,
  p_link TEXT DEFAULT '/bayi/dashboard'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  IF p_dealer_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id FROM public.profiles
    WHERE role = 'DEALER' AND dealer_id = p_dealer_id AND status = 'APPROVED'
  LOOP
    PERFORM public.create_notification(r.id, p_title, p_body, p_type, p_data, p_link);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_all_dealers(
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'menu_update',
  p_data JSONB DEFAULT '{}'::jsonb,
  p_link TEXT DEFAULT '/bayi/dashboard'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles WHERE role = 'DEALER' AND status = 'APPROVED'
  LOOP
    PERFORM public.create_notification(r.id, p_title, p_body, p_type, p_data, p_link);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Push token kaydet (upsert)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_push_token(
  p_token TEXT,
  p_platform TEXT DEFAULT 'web'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL OR NULLIF(TRIM(p_token), '') IS NULL THEN
    RETURN;
  END IF;

  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.user_push_tokens (user_id, role, fcm_token, platform, updated_at)
  VALUES (auth.uid(), v_role, TRIM(p_token), COALESCE(NULLIF(TRIM(p_platform), ''), 'web'), now())
  ON CONFLICT (user_id, fcm_token)
  DO UPDATE SET
    role = EXCLUDED.role,
    platform = EXCLUDED.platform,
    updated_at = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- Tümünü okundu işaretle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sipariş bildirim triggerları
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_name TEXT;
  v_amount TEXT;
  v_data JSONB;
BEGIN
  SELECT COALESCE(name, 'Bayi') INTO v_dealer_name
  FROM public.dealers WHERE id = NEW.dealer_id;

  v_amount := TO_CHAR(COALESCE(NEW.total_amount, 0), 'FM999999990.00');
  v_data := jsonb_build_object(
    'order_id', NEW.id,
    'dealer_id', NEW.dealer_id,
    'status', NEW.status::TEXT,
    'total_amount', NEW.total_amount
  );

  -- Yeni sipariş → adminlere
  IF TG_OP = 'INSERT' AND NEW.status = 'PENDING' THEN
    PERFORM public.notify_all_admins(
      'Yeni Sipariş Geldi!',
      v_dealer_name || ' - ₺' || v_amount || ' tutarında sipariş oluşturdu.',
      'new_order',
      v_data,
      '/admin/dashboard'
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Hazırlanıyor / Onaylandı
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

-- ---------------------------------------------------------------------------
-- Yeni bayi başvurusu → adminlere
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_dealer_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NEW.role = 'DEALER' AND NEW.status = 'PENDING' THEN
    v_name := COALESCE(NULLIF(TRIM(NEW.full_name), ''), 'Yeni başvuru');
    PERFORM public.notify_all_admins(
      'Yeni Bayi Başvurusu',
      v_name || ' onayınızı bekliyor.',
      'dealer_application',
      jsonb_build_object('profile_id', NEW.id, 'full_name', v_name),
      '/admin/basvurular'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_dealer_application ON public.profiles;
CREATE TRIGGER trg_notify_on_dealer_application
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_dealer_application();

-- ---------------------------------------------------------------------------
-- Menü / fiyat güncellemesi → tüm bayilere
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_menu_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sadece anlamlı değişikliklerde bildirim
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_all_dealers(
      'Menü Güncellendi!',
      'Yeni ürünleri ve güncel fiyatları inceleyin.',
      'menu_update',
      jsonb_build_object('product_id', NEW.id, 'action', 'insert'),
      '/bayi/dashboard'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.base_price IS DISTINCT FROM NEW.base_price
       OR OLD.is_active IS DISTINCT FROM NEW.is_active
       OR OLD.name IS DISTINCT FROM NEW.name THEN
      PERFORM public.notify_all_dealers(
        'Menü Güncellendi!',
        'Yeni ürünleri ve güncel fiyatları inceleyin.',
        'menu_update',
        jsonb_build_object('product_id', NEW.id, 'action', 'update'),
        '/bayi/dashboard'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_menu_change ON public.products;
CREATE TRIGGER trg_notify_on_menu_change
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_menu_change();

-- ---------------------------------------------------------------------------
-- Edge Function webhook (opsiyonel — pg_net varsa)
-- notifications INSERT → send-push
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_send_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  -- Secrets: app.settings veya env. Yoksa sessizce geç.
  BEGIN
    v_url := current_setting('app.settings.edge_send_push_url', true);
    v_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_url IS NULL OR v_url = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_key, '')
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'notifications',
        'record', row_to_json(NEW)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_net yoksa veya hata olursa uygulamayı bozma
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_push_on_notification ON public.notifications;
CREATE TRIGGER trg_send_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_push_on_notification();

GRANT EXECUTE ON FUNCTION public.upsert_push_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
