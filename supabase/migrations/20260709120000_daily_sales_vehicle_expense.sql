-- その他経費を号車別カラムに分割 (vehicle1/vehicle2_expense_note, vehicle1/vehicle2_expense_amount)
-- 旧 expense_note / expense_amount は 1 号車へ移行後に削除

BEGIN;

ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS vehicle1_expense_note TEXT,
  ADD COLUMN IF NOT EXISTS vehicle1_expense_amount INTEGER NOT NULL DEFAULT 0
    CHECK (vehicle1_expense_amount >= 0),
  ADD COLUMN IF NOT EXISTS vehicle2_expense_note TEXT,
  ADD COLUMN IF NOT EXISTS vehicle2_expense_amount INTEGER NOT NULL DEFAULT 0
    CHECK (vehicle2_expense_amount >= 0);

UPDATE public.daily_sales
SET
  vehicle1_expense_note = COALESCE(vehicle1_expense_note, expense_note),
  vehicle1_expense_amount = CASE
    WHEN COALESCE(vehicle1_expense_amount, 0) > 0 THEN vehicle1_expense_amount
    ELSE COALESCE(expense_amount, 0)
  END
WHERE (expense_note IS NOT NULL AND expense_note <> '')
   OR COALESCE(expense_amount, 0) > 0;

ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS profit;

ALTER TABLE public.daily_sales
  ADD COLUMN profit INTEGER GENERATED ALWAYS AS (
    (vehicle1_sales + vehicle2_sales)
    - COALESCE(vehicle1_expense_amount, 0)
    - COALESCE(vehicle2_expense_amount, 0)
    - COALESCE(vehicle1_fuel_yen, 0)
    - COALESCE(vehicle2_fuel_yen, 0)
    - labor_cost
  ) STORED;

ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS expense_note;
ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS expense_amount;

-- bulk_import: 経費は Excel 日次行のため 1 号車へ取り込み
CREATE OR REPLACE FUNCTION public.bulk_import_receivables(
  p_period          DATE,
  p_source_file     TEXT,
  p_overwrite       BOOLEAN DEFAULT FALSE,
  p_daily_sales     JSONB   DEFAULT '[]'::JSONB,
  p_staff_sales     JSONB   DEFAULT '[]'::JSONB,
  p_receivables     JSONB   DEFAULT '[]'::JSONB,
  p_fixed_expenses  JSONB   DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_month_start  DATE := date_trunc('month', p_period)::DATE;
  v_month_end    DATE := (date_trunc('month', p_period) + INTERVAL '1 month')::DATE;
  v_invoiced_count INTEGER;
  v_inserted_daily      INTEGER := 0;
  v_inserted_staff      INTEGER := 0;
  v_inserted_recv       INTEGER := 0;
  v_inserted_fixed      INTEGER := 0;
  v_deleted_daily       INTEGER := 0;
  v_deleted_staff       INTEGER := 0;
  v_deleted_recv        INTEGER := 0;
  v_deleted_fixed       INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_invoiced_count
  FROM public.accounts_receivable
  WHERE billing_month = v_month_start
    AND invoice_id IS NOT NULL;

  IF v_invoiced_count > 0 AND p_overwrite THEN
    RAISE EXCEPTION 'bulk_import_receivables: 当月に請求書発行済みデータが % 件あります。先に該当請求書を取消してください', v_invoiced_count
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_overwrite THEN
    DELETE FROM public.accounts_receivable
     WHERE billing_month = v_month_start
       AND invoice_id IS NULL;
    GET DIAGNOSTICS v_deleted_recv = ROW_COUNT;

    DELETE FROM public.daily_sales
     WHERE work_date >= v_month_start AND work_date < v_month_end;
    GET DIAGNOSTICS v_deleted_daily = ROW_COUNT;

    DELETE FROM public.daily_staff_sales
     WHERE work_date >= v_month_start AND work_date < v_month_end;
    GET DIAGNOSTICS v_deleted_staff = ROW_COUNT;

    DELETE FROM public.monthly_fixed_expenses
     WHERE billing_month = v_month_start;
    GET DIAGNOSTICS v_deleted_fixed = ROW_COUNT;
  END IF;

  WITH ins AS (
    INSERT INTO public.daily_sales (
      work_date,
      vehicle1_distance_km, vehicle2_distance_km,
      vehicle1_fuel_yen, vehicle2_fuel_yen,
      vehicle1_sales, vehicle2_sales,
      vehicle1_expense_note, vehicle1_expense_amount,
      vehicle2_expense_note, vehicle2_expense_amount,
      total_hours, receivable_total,
      labor_cost, cash,
      source_file
    )
    SELECT
      (r ->> 'work_date')::DATE,
      NULLIF(r ->> 'vehicle1_distance_km', '')::NUMERIC,
      NULLIF(r ->> 'vehicle2_distance_km', '')::NUMERIC,
      NULLIF(r ->> 'vehicle1_fuel_yen', '')::INTEGER,
      NULLIF(r ->> 'vehicle2_fuel_yen', '')::INTEGER,
      COALESCE((r ->> 'vehicle1_sales')::INTEGER, 0),
      COALESCE((r ->> 'vehicle2_sales')::INTEGER, 0),
      COALESCE(
        NULLIF(r ->> 'vehicle1_expense_note', ''),
        NULLIF(r ->> 'expense_note', '')
      ),
      COALESCE(
        NULLIF(r ->> 'vehicle1_expense_amount', '')::INTEGER,
        (r ->> 'expense_amount')::INTEGER,
        0
      ),
      NULLIF(r ->> 'vehicle2_expense_note', ''),
      COALESCE((r ->> 'vehicle2_expense_amount')::INTEGER, 0),
      COALESCE((r ->> 'total_hours')::NUMERIC, 0),
      COALESCE((r ->> 'receivable_total')::INTEGER, 0),
      COALESCE((r ->> 'labor_cost')::INTEGER, 0),
      COALESCE((r ->> 'cash')::INTEGER, 0),
      p_source_file
    FROM jsonb_array_elements(p_daily_sales) AS r
    ON CONFLICT (work_date) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_daily FROM ins;

  WITH ins AS (
    INSERT INTO public.daily_staff_sales (
      work_date, staff_name, sales, hours, source_file
    )
    SELECT
      (r ->> 'work_date')::DATE,
      r ->> 'staff_name',
      COALESCE((r ->> 'sales')::INTEGER, 0),
      COALESCE((r ->> 'hours')::NUMERIC, 0),
      p_source_file
    FROM jsonb_array_elements(p_staff_sales) AS r
    ON CONFLICT (work_date, staff_name) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_staff FROM ins;

  WITH ins AS (
    INSERT INTO public.accounts_receivable (
      billing_month, company_id, work_date,
      departure, destination, amount, note,
      source_file
    )
    SELECT
      (r ->> 'billing_month')::DATE,
      (r ->> 'company_id')::BIGINT,
      (r ->> 'work_date')::DATE,
      NULLIF(r ->> 'departure', ''),
      NULLIF(r ->> 'destination', ''),
      (r ->> 'amount')::INTEGER,
      NULLIF(r ->> 'note', ''),
      p_source_file
    FROM jsonb_array_elements(p_receivables) AS r
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_recv FROM ins;

  WITH ins AS (
    INSERT INTO public.monthly_fixed_expenses (
      billing_month, label, amount, source_file
    )
    SELECT
      (r ->> 'billing_month')::DATE,
      r ->> 'label',
      COALESCE((r ->> 'amount')::INTEGER, 0),
      p_source_file
    FROM jsonb_array_elements(p_fixed_expenses) AS r
    ON CONFLICT (billing_month, label) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_fixed FROM ins;

  RETURN jsonb_build_object(
    'period',     to_char(v_month_start, 'YYYY-MM-DD'),
    'overwrite',  p_overwrite,
    'inserted', jsonb_build_object(
      'daily_sales',     v_inserted_daily,
      'staff_sales',     v_inserted_staff,
      'receivables',     v_inserted_recv,
      'fixed_expenses',  v_inserted_fixed
    ),
    'deleted', jsonb_build_object(
      'daily_sales',     v_deleted_daily,
      'staff_sales',     v_deleted_staff,
      'receivables',     v_deleted_recv,
      'fixed_expenses',  v_deleted_fixed
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_import_receivables TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_import_receivables FROM anon;
REVOKE EXECUTE ON FUNCTION public.bulk_import_receivables FROM PUBLIC;

COMMIT;
