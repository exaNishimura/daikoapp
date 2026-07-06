-- シフト表の未収入力で取引先を選択できるよう anon に読み取り許可

CREATE POLICY "anon_read" ON public.companies
  FOR SELECT TO anon
  USING (true);
