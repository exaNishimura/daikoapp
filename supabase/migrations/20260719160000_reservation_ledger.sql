-- 予約台帳（reservation-ledger）
-- orders / dispatch_slots とは独立。FK は張らない。

-- ===== reservations =====
CREATE TABLE IF NOT EXISTS public.reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserved_at   TIMESTAMPTZ NOT NULL,
  customer_name TEXT NOT NULL,
  phone         TEXT NOT NULL,
  memo          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reservations_reserved_at_idx
  ON public.reservations (reserved_at);

CREATE INDEX IF NOT EXISTS reservations_customer_name_idx
  ON public.reservations (customer_name);

CREATE INDEX IF NOT EXISTS reservations_phone_idx
  ON public.reservations (phone);

DROP TRIGGER IF EXISTS update_reservations_updated_at ON public.reservations;
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON public.reservations;
CREATE POLICY "public_read" ON public.reservations
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_write" ON public.reservations;
CREATE POLICY "authenticated_write" ON public.reservations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.reservations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reservations TO authenticated;

-- ===== reservation_day_notifications（書込は service_role / Edge Function） =====
CREATE TABLE IF NOT EXISTS public.reservation_day_notifications (
  notify_date   DATE PRIMARY KEY,
  sent_at       TIMESTAMPTZ,
  skipped       BOOLEAN NOT NULL DEFAULT false,
  line_status   INTEGER,
  message_body  TEXT,
  error_message TEXT,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reservation_day_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservation_day_notifications_read" ON public.reservation_day_notifications;
CREATE POLICY "reservation_day_notifications_read" ON public.reservation_day_notifications
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON public.reservation_day_notifications TO anon, authenticated;
