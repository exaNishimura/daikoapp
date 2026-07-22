-- シフト表の未収入力で、未ログインでも取引先を名前だけで追加できるようにする
-- SELECT は既存 anon_read / authenticated_full。UPDATE・DELETE は管理者のみのまま。

DROP POLICY IF EXISTS "anon_insert" ON public.companies;
CREATE POLICY "anon_insert" ON public.companies
  FOR INSERT TO anon
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.companies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;

DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('public.companies', 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated', seq_name);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
