-- シフト表の売上入力から実績勤務時間 (start/end) を匿名更新可能にする
-- 既存: SELECT は anon 可 / 書き込みは authenticated のみ

CREATE POLICY "public_update" ON public.shifts
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
