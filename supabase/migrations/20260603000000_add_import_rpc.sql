-- =============================================================================
-- 20260603000000_add_import_rpc.sql
--
-- Excel ファイルからの月単位一括インポート RPC。
--
-- 仕様:
--   .kiro/specs/receivable-billing/requirements.md Requirement 6
--   .kiro/specs/receivable-billing/tasks.md 10.5
--
-- 提供 RPC:
--   bulk_import_receivables(
--     p_period          DATE,     -- 'YYYY-MM-01'
--     p_source_file     TEXT,
--     p_overwrite       BOOLEAN,  -- true: 同月の既存データを削除してから挿入
--     p_daily_sales     JSONB,
--     p_staff_sales     JSONB,
--     p_receivables     JSONB,
--     p_fixed_expenses  JSONB
--   ) RETURNS jsonb { inserted: {...}, deleted: {...} }
--
-- 動作:
--   1. 対象月の accounts_receivable.invoice_id が non-null の行があれば
--      `请求書発行済みデータがあります` でエラー (Requirement 6.11)。
--   2. p_overwrite=true なら 4 テーブルの同月既存データを DELETE。
--   3. p_overwrite=false (= マージ) なら DELETE しない。重複は UNIQUE 制約で
--      入れ替えはせず、エラー前に呼び出し側で除外しておく前提。
--   4. 各テーブルに INSERT (UPSERT 不要、重複はクライアント側で除外済み)。
--   5. すべて 1 トランザクションで実行 (PL/pgSQL は関数内が暗黙的に 1 tx)。
--
-- SECURITY INVOKER (デフォルト)。authenticated のみ EXECUTE 可。
-- =============================================================================

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
  -- 1. 発行済売掛があれば中断
  SELECT COUNT(*) INTO v_invoiced_count
  FROM public.accounts_receivable
  WHERE billing_month = v_month_start
    AND invoice_id IS NOT NULL;

  IF v_invoiced_count > 0 AND p_overwrite THEN
    RAISE EXCEPTION 'bulk_import_receivables: 当月に請求書発行済みデータが % 件あります。先に該当請求書を取消してください', v_invoiced_count
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2. 上書きモード: 既存削除
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

  -- 3. daily_sales INSERT (work_date UNIQUE)。上書き時は DELETE 済なので INSERT のみ。
  --    マージ時は同 work_date があれば SKIP (ON CONFLICT DO NOTHING)。
  WITH ins AS (
    INSERT INTO public.daily_sales (
      work_date,
      vehicle1_distance_km, vehicle2_distance_km,
      vehicle1_fuel_yen, vehicle2_fuel_yen,
      vehicle1_sales, vehicle2_sales, vehicle3_sales,
      total_hours, receivable_total,
      expense_note, expense_amount, cash,
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
      COALESCE((r ->> 'vehicle3_sales')::INTEGER, 0),
      COALESCE((r ->> 'total_hours')::NUMERIC, 0),
      COALESCE((r ->> 'receivable_total')::INTEGER, 0),
      NULLIF(r ->> 'expense_note', ''),
      COALESCE((r ->> 'expense_amount')::INTEGER, 0),
      COALESCE((r ->> 'cash')::INTEGER, 0),
      p_source_file
    FROM jsonb_array_elements(p_daily_sales) AS r
    ON CONFLICT (work_date) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_daily FROM ins;

  -- 4. daily_staff_sales INSERT ((work_date, staff_name) UNIQUE)
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

  -- 5. accounts_receivable INSERT (UNIQUE NULLS NOT DISTINCT 6 列)
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

  -- 6. monthly_fixed_expenses INSERT ((billing_month, label) UNIQUE)
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
