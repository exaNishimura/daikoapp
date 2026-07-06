-- シフト表からの売掛複数入力: 請求先未選択 (company_id NULL) を許可
-- 匿名アクセス (シフト表) でも accounts_receivable を読み書き可能にする

ALTER TABLE public.accounts_receivable
  ALTER COLUMN company_id DROP NOT NULL;

DROP POLICY IF EXISTS "authenticated_full" ON public.accounts_receivable;

CREATE POLICY "public_read" ON public.accounts_receivable
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_write" ON public.accounts_receivable
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
