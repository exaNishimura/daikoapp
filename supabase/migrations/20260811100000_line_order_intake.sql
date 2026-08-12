-- LINE 受注チャネル正本・設定・電話優先ロック・通知冪等

-- ===== line_intake_settings（シングルトン） =====
CREATE TABLE IF NOT EXISTS public.line_intake_settings (
  id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phone_intake_start_hour  INTEGER NOT NULL DEFAULT 19,
  weekday_fleet_count     INTEGER NOT NULL DEFAULT 1,
  weekend_fleet_count     INTEGER NOT NULL DEFAULT 2,
  max_fleet_count         INTEGER NOT NULL DEFAULT 3,
  extra_capacity_max      INTEGER NOT NULL DEFAULT 2
    CHECK (extra_capacity_max >= 0 AND extra_capacity_max <= 5),
  approval_pin_hash       TEXT,
  pin_failure_count       INTEGER NOT NULL DEFAULT 0,
  pin_locked_until        TIMESTAMPTZ,
  discount_config         JSONB NOT NULL DEFAULT '{"type":"FIXED_YEN","amount":500,"currency":"JPY"}'::jsonb,
  reminder_customer_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.line_intake_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.line_intake_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "line_intake_settings_read" ON public.line_intake_settings;
CREATE POLICY "line_intake_settings_read" ON public.line_intake_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "line_intake_settings_auth_write" ON public.line_intake_settings;
CREATE POLICY "line_intake_settings_auth_write" ON public.line_intake_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.line_intake_settings TO anon, authenticated;
GRANT UPDATE ON public.line_intake_settings TO authenticated;

-- ===== line_bookings（ヘッダ） =====
CREATE TABLE IF NOT EXISTS public.line_bookings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id       TEXT NOT NULL,
  contact_phone      TEXT NOT NULL,
  channel            TEXT NOT NULL DEFAULT 'LINE',
  discount_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PARTIAL','CONFIRMED','EXPIRED','CANCELLED')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS line_bookings_line_user_id_idx
  ON public.line_bookings (line_user_id);
CREATE INDEX IF NOT EXISTS line_bookings_status_idx
  ON public.line_bookings (status);
CREATE INDEX IF NOT EXISTS line_bookings_created_at_idx
  ON public.line_bookings (created_at DESC);

DROP TRIGGER IF EXISTS update_line_bookings_updated_at ON public.line_bookings;
CREATE TRIGGER update_line_bookings_updated_at
  BEFORE UPDATE ON public.line_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.line_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "line_bookings_auth_all" ON public.line_bookings;
CREATE POLICY "line_bookings_auth_all" ON public.line_bookings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "line_bookings_anon_read" ON public.line_bookings;
CREATE POLICY "line_bookings_anon_read" ON public.line_bookings
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.line_bookings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.line_bookings TO authenticated;

-- ===== line_booking_units（台単位） =====
CREATE TABLE IF NOT EXISTS public.line_booking_units (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           UUID NOT NULL REFERENCES public.line_bookings(id) ON DELETE CASCADE,
  sequence             INTEGER NOT NULL DEFAULT 1,
  pickup_at            TIMESTAMPTZ NOT NULL,
  pickup_address       TEXT NOT NULL,
  dropoff_address      TEXT NOT NULL,
  vehicle_info         TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT 'HOLDING'
    CHECK (status IN ('HOLDING','CONFIRMED','EXPIRED','CANCELLED')),
  hold_until           TIMESTAMPTZ,
  uses_extra_capacity  BOOLEAN NOT NULL DEFAULT false,
  order_id             UUID,
  reservation_id       UUID,
  projection_error     TEXT,
  confirmed_at         TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  admin_note           TEXT,
  base_duration_min    INTEGER,
  buffer_min           INTEGER,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS line_booking_units_booking_id_idx
  ON public.line_booking_units (booking_id);
CREATE INDEX IF NOT EXISTS line_booking_units_status_idx
  ON public.line_booking_units (status);
CREATE INDEX IF NOT EXISTS line_booking_units_hold_until_idx
  ON public.line_booking_units (hold_until)
  WHERE status = 'HOLDING';
CREATE INDEX IF NOT EXISTS line_booking_units_pickup_at_idx
  ON public.line_booking_units (pickup_at);

DROP TRIGGER IF EXISTS update_line_booking_units_updated_at ON public.line_booking_units;
CREATE TRIGGER update_line_booking_units_updated_at
  BEFORE UPDATE ON public.line_booking_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.line_booking_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "line_booking_units_auth_all" ON public.line_booking_units;
CREATE POLICY "line_booking_units_auth_all" ON public.line_booking_units
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "line_booking_units_anon_read" ON public.line_booking_units;
CREATE POLICY "line_booking_units_anon_read" ON public.line_booking_units
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.line_booking_units TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.line_booking_units TO authenticated;

-- ===== phone_priority_locks =====
CREATE TABLE IF NOT EXISTS public.phone_priority_locks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_day     DATE NOT NULL,
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL,
  reason           TEXT NOT NULL CHECK (reason IN ('TAKEN','REJECTED')),
  source_order_id  UUID,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS phone_priority_locks_range_idx
  ON public.phone_priority_locks (start_at, end_at);
CREATE INDEX IF NOT EXISTS phone_priority_locks_business_day_idx
  ON public.phone_priority_locks (business_day);

ALTER TABLE public.phone_priority_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phone_priority_locks_auth_all" ON public.phone_priority_locks;
CREATE POLICY "phone_priority_locks_auth_all" ON public.phone_priority_locks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "phone_priority_locks_anon_read" ON public.phone_priority_locks;
CREATE POLICY "phone_priority_locks_anon_read" ON public.phone_priority_locks
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.phone_priority_locks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.phone_priority_locks TO authenticated;

-- ===== line_notification_logs（冪等） =====
CREATE TABLE IF NOT EXISTS public.line_notification_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL,
  dedupe_key    TEXT NOT NULL,
  target        TEXT,
  status        TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, dedupe_key)
);

ALTER TABLE public.line_notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "line_notification_logs_auth_read" ON public.line_notification_logs;
CREATE POLICY "line_notification_logs_auth_read" ON public.line_notification_logs
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.line_notification_logs TO authenticated;
-- 書込は service_role（Edge）想定
