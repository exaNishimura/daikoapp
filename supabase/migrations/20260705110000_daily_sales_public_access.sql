-- シフト表からの匿名売上入力に対応（配車・シフトと同様に anon も読み書き可）
DROP POLICY IF EXISTS "authenticated_full" ON public.daily_sales;

CREATE POLICY "public_read" ON public.daily_sales
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_write" ON public.daily_sales
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
