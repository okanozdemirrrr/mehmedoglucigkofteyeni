-- =============================================================================
-- MEHMEDOĞLU ÇİĞKÖFTE - Mergen B2B Platform
-- Supabase PostgreSQL Migration: Tablolar, RLS, Trigger
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('ADMIN', 'DEALER');
CREATE TYPE order_status AS ENUM ('PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED');
CREATE TYPE transaction_type AS ENUM ('DEBT', 'RECEIPT');

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- Bayiler (Distribütör müşterileri)
CREATE TABLE public.dealers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  tax_no      TEXT,
  phone       TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kullanıcı profilleri (auth.users ile birebir)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'DEALER',
  dealer_id   UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_dealer_required CHECK (
    role = 'ADMIN' OR dealer_id IS NOT NULL
  )
);

-- Ürünler
CREATE TABLE public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  base_price      NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  modifiers_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bayiye özel fiyatlar
CREATE TABLE public.dealer_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id     UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_price  NUMERIC(12, 2) NOT NULL CHECK (custom_price >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, product_id)
);

-- Siparişler
CREATE TABLE public.orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id     UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  total_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status        order_status NOT NULL DEFAULT 'PENDING',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sipariş kalemleri
CREATE TABLE public.order_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id              UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity                INTEGER NOT NULL CHECK (quantity > 0),
  unit_price              NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  selected_modifiers_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cari hesap hareketleri (Borç / Tahsilat)
CREATE TABLE public.transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id         UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  transaction_type  transaction_type NOT NULL,
  amount            NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description       TEXT,
  order_id          UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_profiles_dealer_id ON public.profiles(dealer_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_dealer_prices_dealer ON public.dealer_prices(dealer_id);
CREATE INDEX idx_dealer_prices_product ON public.dealer_prices(product_id);
CREATE INDEX idx_orders_dealer_id ON public.orders(dealer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_transactions_dealer_id ON public.transactions(dealer_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------------

-- Mevcut kullanıcının rolünü döndür
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Mevcut kullanıcının dealer_id'sini döndür
CREATE OR REPLACE FUNCTION public.get_my_dealer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dealer_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Bayi bakiyesi: Toplam Borç - Toplam Tahsilat
CREATE OR REPLACE FUNCTION public.get_dealer_balance(p_dealer_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN transaction_type = 'DEBT' THEN amount
        WHEN transaction_type = 'RECEIPT' THEN -amount
        ELSE 0
      END
    ),
    0
  )
  FROM public.transactions
  WHERE dealer_id = p_dealer_id;
$$;

-- Yeni auth kullanıcısı için profil oluştur (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_text TEXT;
  v_role user_role;
  v_dealer_id UUID;
BEGIN
  v_role_text := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')));

  BEGIN
    v_dealer_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'dealer_id', '')), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_dealer_id := NULL;
  END;

  IF v_role_text = 'ADMIN' THEN
    v_role := 'ADMIN';
  ELSIF v_role_text = 'DEALER' THEN
    v_role := 'DEALER';
  ELSIF v_dealer_id IS NOT NULL THEN
    v_role := 'DEALER';
  ELSE
    v_role := 'ADMIN';
  END IF;

  IF v_role = 'DEALER' AND v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'DEALER kullanıcısı için User Metadata içinde dealer_id zorunludur.';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, dealer_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    v_role,
    CASE WHEN v_role = 'ADMIN' THEN NULL ELSE v_dealer_id END
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profil oluşturulamadı: %', SQLERRM;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- orders.updated_at otomatik güncelle
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- FINANS MOTORU: Sipariş DELIVERED olunca otomatik borç kaydı
-- =============================================================================
CREATE OR REPLACE FUNCTION public.on_order_delivered_create_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sadece status DELIVERED'a geçtiğinde ve daha önce kayıt yoksa
  IF NEW.status = 'DELIVERED'
     AND (OLD.status IS DISTINCT FROM 'DELIVERED')
     AND NEW.total_amount > 0
  THEN
    -- Aynı sipariş için çift borç kaydını engelle
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions
      WHERE order_id = NEW.id AND transaction_type = 'DEBT'
    ) THEN
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
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_order_delivered_debt
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.on_order_delivered_create_debt();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'ADMIN'
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DEALERS
CREATE POLICY "dealers_select_admin_or_own"
  ON public.dealers FOR SELECT
  USING (
    public.get_my_role() = 'ADMIN'
    OR id = public.get_my_dealer_id()
  );

CREATE POLICY "dealers_insert_admin"
  ON public.dealers FOR INSERT
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "dealers_update_admin"
  ON public.dealers FOR UPDATE
  USING (public.get_my_role() = 'ADMIN');

-- PRODUCTS
CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE
  USING (public.get_my_role() = 'ADMIN');

-- DEALER PRICES
CREATE POLICY "dealer_prices_select"
  ON public.dealer_prices FOR SELECT
  USING (
    public.get_my_role() = 'ADMIN'
    OR dealer_id = public.get_my_dealer_id()
  );

CREATE POLICY "dealer_prices_admin_write"
  ON public.dealer_prices FOR ALL
  USING (public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_role() = 'ADMIN');

-- ORDERS
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    public.get_my_role() = 'ADMIN'
    OR dealer_id = public.get_my_dealer_id()
  );

CREATE POLICY "orders_insert_dealer"
  ON public.orders FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'DEALER'
    AND dealer_id = public.get_my_dealer_id()
  );

CREATE POLICY "orders_update_admin"
  ON public.orders FOR UPDATE
  USING (public.get_my_role() = 'ADMIN');

-- ORDER ITEMS
CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          public.get_my_role() = 'ADMIN'
          OR o.dealer_id = public.get_my_dealer_id()
        )
    )
  );

CREATE POLICY "order_items_insert_dealer"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.dealer_id = public.get_my_dealer_id()
        AND public.get_my_role() = 'DEALER'
    )
  );

-- TRANSACTIONS
CREATE POLICY "transactions_select"
  ON public.transactions FOR SELECT
  USING (
    public.get_my_role() = 'ADMIN'
    OR dealer_id = public.get_my_dealer_id()
  );

CREATE POLICY "transactions_insert_admin_receipt"
  ON public.transactions FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'ADMIN'
    AND transaction_type = 'RECEIPT'
  );

-- ---------------------------------------------------------------------------
-- RPC: Admin tahsilat kaydı
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_receipt(
  p_dealer_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Yetkisiz işlem';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Geçersiz tutar';
  END IF;

  INSERT INTO public.transactions (dealer_id, transaction_type, amount, description)
  VALUES (p_dealer_id, 'RECEIPT', p_amount, COALESCE(p_description, 'Tahsilat'))
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: Bayi sipariş oluştur
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
  v_dealer_id UUID;
  v_order_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_modifiers JSONB;
  v_total NUMERIC := 0;
  v_line_total NUMERIC;
BEGIN
  v_dealer_id := public.get_my_dealer_id();

  IF public.get_my_role() IS DISTINCT FROM 'DEALER' OR v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sepet boş';
  END IF;

  -- Toplam hesapla
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    SELECT COALESCE(dp.custom_price, p.base_price)
    INTO v_unit_price
    FROM public.products p
    LEFT JOIN public.dealer_prices dp
      ON dp.product_id = p.id AND dp.dealer_id = v_dealer_id
    WHERE p.id = v_product_id AND p.is_active = true;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'Ürün bulunamadı: %', v_product_id;
    END IF;

    v_total := v_total + (v_unit_price * v_quantity);
  END LOOP;

  INSERT INTO public.orders (dealer_id, total_amount, status)
  VALUES (v_dealer_id, v_total, 'PENDING')
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_modifiers := COALESCE(v_item->'selected_modifiers', '{}'::jsonb);

    SELECT COALESCE(dp.custom_price, p.base_price)
    INTO v_unit_price
    FROM public.products p
    LEFT JOIN public.dealer_prices dp
      ON dp.product_id = p.id AND dp.dealer_id = v_dealer_id
    WHERE p.id = v_product_id;

    INSERT INTO public.order_items (
      order_id, product_id, quantity, unit_price, selected_modifiers_jsonb
    ) VALUES (
      v_order_id, v_product_id, v_quantity, v_unit_price, v_modifiers
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- SEED DATA (Opsiyonel - geliştirme ortamı için)
-- ---------------------------------------------------------------------------
-- Not: Admin kullanıcı Supabase Dashboard > Authentication üzerinden oluşturulmalı
-- ve raw_user_meta_data: {"role": "ADMIN", "full_name": "Admin"} ile kaydedilmeli.

INSERT INTO public.dealers (id, name, tax_no, phone, address) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Örnek Bayi A.Ş.', '1234567890', '0532 000 00 01', 'İstanbul'),
  ('a0000000-0000-4000-8000-000000000002', 'Test Toptancı Ltd.', '9876543210', '0533 000 00 02', 'Ankara');

INSERT INTO public.products (name, base_price, is_active, modifiers_jsonb) VALUES
  (
    'Standart Çiğköfte Porsiyon',
    45.00,
    true,
    '[{"key":"spiciness","label":"Acılık","required":true,"options":["Acılı","Acısız"]}]'::jsonb
  ),
  (
    'Mega Çiğköfte Porsiyon',
    65.00,
    true,
    '[{"key":"spiciness","label":"Acılık","required":true,"options":["Acılı","Acısız"]}]'::jsonb
  ),
  (
    'Lavaş Ekstra',
    8.00,
    true,
    '[]'::jsonb
  );

INSERT INTO public.dealer_prices (dealer_id, product_id, custom_price)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  p.id,
  p.base_price * 0.95
FROM public.products p;
