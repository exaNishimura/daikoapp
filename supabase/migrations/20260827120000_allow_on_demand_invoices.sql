-- =============================================================================
-- 20260827120000_allow_on_demand_invoices.sql
--
-- 都度請求対応:
--   - invoices の UNIQUE(company_id, billing_month) を撤廃し、同月・同社で
--     複数回発行できるようにする。
--   - issue_invoice に任意の売掛 ID 配列を追加。指定時はその明細だけ紐付ける
--     （再発行時に他の未請求都度分を巻き込まないため）。
-- =============================================================================

-- 1. 同月二重発行防止制約を撤廃（検索用 index は残す）
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_company_id_billing_month_key;

CREATE INDEX IF NOT EXISTS idx_invoices_company_billing_month
  ON public.invoices (company_id, billing_month);

-- 2. issue_invoice を差し替え（旧シグネチャを DROP してから再定義）
DROP FUNCTION IF EXISTS public.issue_invoice(
  BIGINT, DATE, DATE, INTEGER, INTEGER, JSONB, TEXT
);

CREATE OR REPLACE FUNCTION public.issue_invoice(
  p_company_id        BIGINT,
  p_billing_month     DATE,
  p_issue_date        DATE,
  p_total_amount      INTEGER,
  p_line_count        INTEGER,
  p_profile_snapshot  JSONB,
  p_file_path         TEXT DEFAULT NULL,
  p_receivable_ids    BIGINT[] DEFAULT NULL
)
RETURNS public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice       public.invoices%ROWTYPE;
  v_actual_count  INTEGER;
  v_actual_total  INTEGER;
  v_matched_ids   INTEGER;
BEGIN
  IF p_receivable_ids IS NOT NULL THEN
    -- 指定明細のみ対象。会社・請求月・未請求であることを検証する。
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
      INTO v_actual_count, v_actual_total
    FROM public.accounts_receivable
    WHERE company_id = p_company_id
      AND billing_month = p_billing_month
      AND invoice_id IS NULL
      AND id = ANY (p_receivable_ids);

    SELECT COUNT(*) INTO v_matched_ids
    FROM unnest(p_receivable_ids) AS t(id);

    IF v_actual_count <> v_matched_ids THEN
      RAISE EXCEPTION
        'issue_invoice: receivable_ids mismatch (requested=%, matchable=%)',
        v_matched_ids, v_actual_count
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    -- 従来どおり: 当月・当社・未請求の全件
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
      INTO v_actual_count, v_actual_total
    FROM public.accounts_receivable
    WHERE company_id = p_company_id
      AND billing_month = p_billing_month
      AND invoice_id IS NULL;
  END IF;

  IF v_actual_count <> p_line_count THEN
    RAISE EXCEPTION 'issue_invoice: line_count mismatch (expected=%, actual=%)',
      p_line_count, v_actual_count
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_actual_total <> p_total_amount THEN
    RAISE EXCEPTION 'issue_invoice: total_amount mismatch (expected=%, actual=%)',
      p_total_amount, v_actual_total
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_actual_count = 0 THEN
    RAISE EXCEPTION 'issue_invoice: no unbilled receivables to issue'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.invoices (
    company_id, billing_month, issue_date, total_amount, line_count,
    profile_snapshot, file_path
  )
  VALUES (
    p_company_id, p_billing_month, p_issue_date, p_total_amount, p_line_count,
    p_profile_snapshot, p_file_path
  )
  RETURNING * INTO v_invoice;

  IF p_receivable_ids IS NOT NULL THEN
    UPDATE public.accounts_receivable
       SET invoice_id = v_invoice.id,
           updated_at = NOW()
     WHERE company_id = p_company_id
       AND billing_month = p_billing_month
       AND invoice_id IS NULL
       AND id = ANY (p_receivable_ids);
  ELSE
    UPDATE public.accounts_receivable
       SET invoice_id = v_invoice.id,
           updated_at = NOW()
     WHERE company_id = p_company_id
       AND billing_month = p_billing_month
       AND invoice_id IS NULL;
  END IF;

  RETURN v_invoice;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_invoice(
  BIGINT, DATE, DATE, INTEGER, INTEGER, JSONB, TEXT, BIGINT[]
) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_invoice(
  BIGINT, DATE, DATE, INTEGER, INTEGER, JSONB, TEXT, BIGINT[]
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.issue_invoice(
  BIGINT, DATE, DATE, INTEGER, INTEGER, JSONB, TEXT, BIGINT[]
) FROM PUBLIC;
