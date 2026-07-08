-- daily_staff_sales: anon からの UPSERT を確実に通す
-- (FOR ALL 単体だと INSERT/UPDATE の RLS 判定で失敗することがあるためコマンド別に分離)

DROP POLICY IF EXISTS "public_read" ON public.daily_staff_sales;
DROP POLICY IF EXISTS "public_write" ON public.daily_staff_sales;
DROP POLICY IF EXISTS "authenticated_full" ON public.daily_staff_sales;

CREATE POLICY "daily_staff_sales_select" ON public.daily_staff_sales
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "daily_staff_sales_insert" ON public.daily_staff_sales
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "daily_staff_sales_update" ON public.daily_staff_sales
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "daily_staff_sales_delete" ON public.daily_staff_sales
  FOR DELETE TO anon, authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_staff_sales TO anon, authenticated;

DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('public.daily_staff_sales', 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated', seq_name);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
