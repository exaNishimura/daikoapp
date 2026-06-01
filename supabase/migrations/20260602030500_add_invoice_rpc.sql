-- =============================================================================
-- 20260602030500_add_invoice_rpc.sql
--
-- 請求書発行・取消・入金記録の各処理を 1 トランザクションでアトミックに行う RPC を追加する。
--
-- 仕様:
--   .kiro/specs/receivable-billing/design.md (3.5, 3.6, NFR-1)
--   tasks.md 3.8
--
-- 提供 RPC:
--   1. issue_invoice(company_id, billing_month, issue_date, total_amount,
--                    line_count, profile_snapshot, file_path)
--      → 未請求の accounts_receivable をまとめて invoices 1 行に紐付ける。
--        同月二重発行は invoices の UNIQUE 制約で防止。
--
--   2. revoke_invoice(invoice_id)
--      → 未入金の invoices を削除し、紐付いていた accounts_receivable.invoice_id を NULL に戻す。
--        入金済 (paid_at IS NOT NULL) の場合はエラー。
--
--   3. mark_invoice_paid(invoice_id, paid_at)
--      → invoices.paid_at をセット。既に入金済ならエラー。
--
-- 全 RPC で SECURITY INVOKER (デフォルト)。RLS は呼び出しユーザーに従う。
-- authenticated ロールのみ EXECUTE 権限を付与する (anon は不可)。
-- =============================================================================

-- ===== 1. issue_invoice =====
CREATE OR REPLACE FUNCTION public.issue_invoice(
  p_company_id        BIGINT,
  p_billing_month     DATE,
  p_issue_date        DATE,
  p_total_amount      INTEGER,
  p_line_count        INTEGER,
  p_profile_snapshot  JSONB,
  p_file_path         TEXT DEFAULT NULL
)
RETURNS public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice  public.invoices%ROWTYPE;
  v_actual_count  INTEGER;
  v_actual_total  INTEGER;
BEGIN
  -- 売掛の検算: 当月・当社・未請求 の集計が引数と一致するか確認する。
  -- データ不整合 (フロント / バックエンドのズレ) を発行段階で検知する。
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_actual_count, v_actual_total
  FROM public.accounts_receivable
  WHERE company_id = p_company_id
    AND billing_month = p_billing_month
    AND invoice_id IS NULL;

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

  -- invoices に 1 行 INSERT (UNIQUE 制約で同月二重発行を防止)。
  INSERT INTO public.invoices (
    company_id, billing_month, issue_date, total_amount, line_count,
    profile_snapshot, file_path
  )
  VALUES (
    p_company_id, p_billing_month, p_issue_date, p_total_amount, p_line_count,
    p_profile_snapshot, p_file_path
  )
  RETURNING * INTO v_invoice;

  -- 当月・当社・未請求 の accounts_receivable に invoice_id を紐付ける。
  UPDATE public.accounts_receivable
     SET invoice_id = v_invoice.id,
         updated_at = NOW()
   WHERE company_id = p_company_id
     AND billing_month = p_billing_month
     AND invoice_id IS NULL;

  RETURN v_invoice;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_invoice TO authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_invoice FROM anon;
REVOKE EXECUTE ON FUNCTION public.issue_invoice FROM PUBLIC;


-- ===== 2. revoke_invoice =====
CREATE OR REPLACE FUNCTION public.revoke_invoice(p_invoice_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_paid_at  TIMESTAMPTZ;
BEGIN
  SELECT paid_at INTO v_paid_at
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'revoke_invoice: invoice id=% not found', p_invoice_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'revoke_invoice: invoice id=% is already paid', p_invoice_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 紐付いていた売掛を未請求に戻す (FK は ON DELETE SET NULL なので
  -- DELETE だけでも動くが、明示的に NULL にしておく方が監査ログ的に明確)。
  UPDATE public.accounts_receivable
     SET invoice_id = NULL,
         updated_at = NOW()
   WHERE invoice_id = p_invoice_id;

  DELETE FROM public.invoices WHERE id = p_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_invoice TO authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_invoice FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_invoice FROM PUBLIC;


-- ===== 3. mark_invoice_paid =====
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  p_invoice_id BIGINT,
  p_paid_at    TIMESTAMPTZ DEFAULT NOW()
)
RETURNS public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice  public.invoices%ROWTYPE;
BEGIN
  UPDATE public.invoices
     SET paid_at    = p_paid_at,
         updated_at = NOW()
   WHERE id = p_invoice_id
     AND paid_at IS NULL
  RETURNING * INTO v_invoice;

  IF NOT FOUND THEN
    -- 既に paid_at がセット済か、id 自体が存在しない。
    IF EXISTS (SELECT 1 FROM public.invoices WHERE id = p_invoice_id) THEN
      RAISE EXCEPTION 'mark_invoice_paid: invoice id=% is already paid', p_invoice_id
        USING ERRCODE = 'check_violation';
    ELSE
      RAISE EXCEPTION 'mark_invoice_paid: invoice id=% not found', p_invoice_id
        USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  RETURN v_invoice;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_invoice_paid TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid FROM PUBLIC;
