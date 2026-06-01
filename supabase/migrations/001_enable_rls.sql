-- 001_enable_rls.sql
-- 既存テーブル全部に Row Level Security を有効化する。
--
-- 運用方針:
--   - 配車画面 (/) と シフト表 (/shift) はスタッフが匿名で利用するため、
--     対応するテーブルは anon ロールにも読み書きを許可する。
--   - シフト編集 (/shift/edit) と 従業員管理 (/employees) は管理者専用。
--     対応する shifts/employees テーブルは authenticated のみ書き込み可。
--
-- このマイグレーションを適用する前に Supabase Auth で
-- 管理者ユーザーを作成しておくこと。
-- ロールバック: supabase/migrations/001_enable_rls_rollback.sql

-- ===== RLS 有効化 =====
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_operation_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- ===== 配車関連: 全ユーザーに全権 =====
-- スタッフが匿名で配車画面を操作するため、anon にも書き込み許可

-- vehicles
DROP POLICY IF EXISTS "public_all_access" ON public.vehicles;
CREATE POLICY "public_all_access" ON public.vehicles
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "public_all_access" ON public.orders;
CREATE POLICY "public_all_access" ON public.orders
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- dispatch_slots
DROP POLICY IF EXISTS "public_all_access" ON public.dispatch_slots;
CREATE POLICY "public_all_access" ON public.dispatch_slots
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- vehicle_operation_status
DROP POLICY IF EXISTS "public_all_access" ON public.vehicle_operation_status;
CREATE POLICY "public_all_access" ON public.vehicle_operation_status
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ===== シフト/従業員: 読み込みは公開、書き込みは管理者のみ =====

-- shifts: SELECT は anon + authenticated、書き込みは authenticated のみ
DROP POLICY IF EXISTS "public_read" ON public.shifts;
DROP POLICY IF EXISTS "authenticated_write" ON public.shifts;
CREATE POLICY "public_read" ON public.shifts
  FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "authenticated_write" ON public.shifts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- employees: SELECT は anon + authenticated、書き込みは authenticated のみ
DROP POLICY IF EXISTS "public_read" ON public.employees;
DROP POLICY IF EXISTS "authenticated_write" ON public.employees;
CREATE POLICY "public_read" ON public.employees
  FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "authenticated_write" ON public.employees
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ===== 確認用クエリ =====
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;
