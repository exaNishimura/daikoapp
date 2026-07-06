-- シフト表の売上入力からスタッフ別稼働時間を匿名で読み書き可能にする
DROP POLICY IF EXISTS "authenticated_full" ON public.daily_staff_sales;

CREATE POLICY "public_read" ON public.daily_staff_sales
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_write" ON public.daily_staff_sales
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
