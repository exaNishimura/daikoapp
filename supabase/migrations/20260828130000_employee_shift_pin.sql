-- 従業員ごとのシフト希望 PIN（配車画面の approval_pin とは別）
-- 希望提出データは Edge Function 経由のみ（直接 RLS アクセス不可）

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS shift_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS shift_pin_failures INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift_pin_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shift_pin_configured BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.shift_pin_hash IS 'シフト希望提出用 PIN ハッシュ（配車 PIN とは別）';
COMMENT ON COLUMN public.employees.shift_pin_configured IS 'PIN 設定済みフラグ（ハッシュ自体は anon に公開しない）';

CREATE TABLE IF NOT EXISTS public.shift_availability_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month        DATE NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, month)
);

CREATE INDEX IF NOT EXISTS idx_shift_avail_req_month
  ON public.shift_availability_requests (month);

CREATE INDEX IF NOT EXISTS idx_shift_avail_req_employee
  ON public.shift_availability_requests (employee_id);

ALTER TABLE public.shift_availability_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_avail_no_direct" ON public.shift_availability_requests;
CREATE POLICY "shift_avail_no_direct" ON public.shift_availability_requests
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- anon は PIN 関連列を読めない（シフト表等で必要な列のみ）
REVOKE ALL ON public.employees FROM anon;
GRANT SELECT (
  id,
  name,
  license_type,
  color,
  hourly_wage,
  is_active,
  sort_order,
  created_at,
  updated_at,
  shift_pin_configured
) ON public.employees TO anon;
