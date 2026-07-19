-- 予約台帳: 未ログイン（anon）でも登録・編集・削除可能にする（配車・売掛の公衆運用に合わせる）

DROP POLICY IF EXISTS "authenticated_write" ON public.reservations;

DROP POLICY IF EXISTS "public_write" ON public.reservations;
CREATE POLICY "public_write" ON public.reservations
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO anon, authenticated;
