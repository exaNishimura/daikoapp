-- =============================================================================
-- 20260101000000_initial_schema.sql
--
-- Baseline schema for daikoapp.
--
-- 本番 DB では既に手動 SQL で作成済みのため、このファイルを `apply_migration`
-- で実行することはない。新しい環境 (preview / staging / 別プロジェクト) を
-- 立ち上げるとき、または `supabase db reset` で空 DB から再現するときに、
-- 同じ最終形を作るためのリファレンス兼セットアップスクリプト。
--
-- 旧 supabase/*.sql の patch は supabase/legacy/ にアーカイブ済み。
--
-- 作成順:
--   1. updated_at 自動更新トリガー関数
--   2. vehicles
--   3. orders
--   4. dispatch_slots
--   5. vehicle_operation_status
--   6. employees
--   7. shifts
--   8. updated_at トリガー
--   9. インデックス
--   10. 初期データ (vehicles のみ)
--
-- 本ファイルは冪等 (CREATE TABLE IF NOT EXISTS / DROP TRIGGER IF EXISTS)。
-- =============================================================================

-- ===== updated_at 自動更新トリガー関数 =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== vehicles =====
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     VARCHAR(50) NOT NULL,
  is_active                BOOLEAN DEFAULT true,
  sort_order               INT NOT NULL,
  waiting_location_address TEXT,
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== orders =====
CREATE TABLE IF NOT EXISTS public.orders (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  order_type               VARCHAR(20) NOT NULL
                            CHECK (order_type IN ('NOW', 'SCHEDULED')),
  scheduled_at             TIMESTAMP WITH TIME ZONE,
  pickup_address           TEXT NOT NULL,
  pickup_location          TEXT,
  dropoff_address          TEXT NOT NULL,
  waypoints                JSONB DEFAULT '[]'::jsonb,
  waiting_location_address TEXT,
  contact_phone            VARCHAR(20),
  car_model                VARCHAR(50),
  car_plate                VARCHAR(10),
  car_color                VARCHAR(20),
  parking_note             TEXT,
  base_duration_min        INT,
  buffer_min               INT,
  buffer_manual            BOOLEAN DEFAULT false,
  status                   VARCHAR(20) NOT NULL DEFAULT 'UNASSIGNED'
                            CHECK (status IN (
                              'UNASSIGNED', 'TENTATIVE', 'CONFIRMED',
                              'ARRIVED', 'PICKING_UP', 'IN_TRANSIT',
                              'COMPLETED', 'CANCELLED'
                            )),
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== dispatch_slots =====
CREATE TABLE IF NOT EXISTS public.dispatch_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vehicle_id    UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  start_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at        TIMESTAMP WITH TIME ZONE NOT NULL,
  start_row     INT CHECK (start_row >= 0 AND start_row <= 47),
  duration_rows INT CHECK (duration_rows > 0 AND duration_rows <= 48),
  status        VARCHAR(20) NOT NULL DEFAULT 'TENTATIVE'
                  CHECK (status IN ('TENTATIVE', 'CONFIRMED')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_end_after_start CHECK (end_at > start_at)
);

-- ===== vehicle_operation_status =====
-- 1 日単位で 4 種類の状態を時刻付きで持つ:
--   DEFAULT  ... 通常稼働 (時刻なし)
--   DAY_OFF  ... 終日休業
--   STOP     ... 当日この時刻から停止
--   START    ... 当日この時刻から再開
CREATE TABLE IF NOT EXISTS public.vehicle_operation_status (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  type       VARCHAR(20) NOT NULL
              CHECK (type IN ('DEFAULT', 'DAY_OFF', 'STOP', 'START')),
  time       TIME WITHOUT TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== employees =====
CREATE TABLE IF NOT EXISTS public.employees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(50) NOT NULL UNIQUE,
  license_type VARCHAR(10) NOT NULL
                CHECK (license_type IN ('一種', '二種')),
  color        VARCHAR(20) NOT NULL,
  hourly_wage  NUMERIC NOT NULL DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== shifts =====
-- 1 日 1 行ではなく、車 × ロール × スタッフ単位で複数行入る。
-- status が入っている行は休業/定休日を表し、車・スタッフ等は NULL のまま。
CREATE TABLE IF NOT EXISTS public.shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE NOT NULL,
  dow        VARCHAR(2) NOT NULL,
  car        VARCHAR(10),
  role       VARCHAR(10) CHECK (role IN ('代行', '随伴')),
  staff      VARCHAR(50),
  start      TIME WITHOUT TIME ZONE,
  "end"      TIME WITHOUT TIME ZONE,
  note       TEXT,
  status     VARCHAR(20) CHECK (status IN ('休業', '定休日')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== updated_at トリガー =====
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_dispatch_slots_updated_at ON public.dispatch_slots;
CREATE TRIGGER update_dispatch_slots_updated_at
  BEFORE UPDATE ON public.dispatch_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicle_operation_status_updated_at
  ON public.vehicle_operation_status;
CREATE TRIGGER update_vehicle_operation_status_updated_at
  BEFORE UPDATE ON public.vehicle_operation_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== インデックス =====
CREATE INDEX IF NOT EXISTS idx_vehicles_active
  ON public.vehicles(is_active);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_slots_vehicle_time
  ON public.dispatch_slots(vehicle_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_slots_order
  ON public.dispatch_slots(order_id);
CREATE INDEX IF NOT EXISTS idx_slots_status
  ON public.dispatch_slots(status);

CREATE INDEX IF NOT EXISTS idx_vehicle_operation_status_lookup
  ON public.vehicle_operation_status(vehicle_id, date);

CREATE INDEX IF NOT EXISTS idx_shifts_date
  ON public.shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_date_car_role
  ON public.shifts(date, car, role);

CREATE INDEX IF NOT EXISTS idx_employees_active_sort
  ON public.employees(is_active, sort_order);

-- ===== 初期データ: 車両 =====
INSERT INTO public.vehicles (name, sort_order) VALUES
  ('1号車', 1),
  ('2号車', 2)
ON CONFLICT DO NOTHING;
