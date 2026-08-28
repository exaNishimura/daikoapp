-- =============================================================================
-- 20260828120000_unmark_invoice_paid.sql
--
-- 入金記録の取り消し（paid_at を NULL に戻す）。
-- UI の入金チェックボックス解除に対応。
-- =============================================================================

CREATE OR REPLACE FUNCTION public.unmark_invoice_paid(p_invoice_id BIGINT)
RETURNS public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
BEGIN
  UPDATE public.invoices
     SET paid_at    = NULL,
         updated_at = NOW()
   WHERE id = p_invoice_id
     AND paid_at IS NOT NULL
  RETURNING * INTO v_invoice;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.invoices WHERE id = p_invoice_id) THEN
      RAISE EXCEPTION 'unmark_invoice_paid: invoice id=% is not paid', p_invoice_id
        USING ERRCODE = 'check_violation';
    ELSE
      RAISE EXCEPTION 'unmark_invoice_paid: invoice id=% not found', p_invoice_id
        USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  RETURN v_invoice;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unmark_invoice_paid(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.unmark_invoice_paid(BIGINT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmark_invoice_paid(BIGINT) FROM PUBLIC;
