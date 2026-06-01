-- 001_enable_rls.sql
-- 既存テーブル全部に Row Level Security を有効化し、
-- ログイン済み(authenticated)なら全権を持つポリシーを設定する。
-- 
-- このマイグレーションを適用する前に Supabase Auth で
-- 管理者ユーザーを作成しておくこと（さもないと自分も締め出される）。
--
-- ロールバック: supabase/migrations/001_enable_rls_rollback.sql を参照

-- ===== RLS 有効化 =====
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_operation_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- ===== ポリシー: ログイン済みなら全権 =====
-- 既存ポリシーがあれば DROP してから CREATE（冪等性）

-- vehicles
DROP POLICY IF EXISTS "authenticated_all_access" ON public.vehicles;
CREATE POLICY "authenticated_all_access" ON public.vehicles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "authenticated_all_access" ON public.orders;
CREATE POLICY "authenticated_all_access" ON public.orders
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- dispatch_slots
DROP POLICY IF EXISTS "authenticated_all_access" ON public.dispatch_slots;
CREATE POLICY "authenticated_all_access" ON public.dispatch_slots
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- vehicle_operation_status
DROP POLICY IF EXISTS "authenticated_all_access" ON public.vehicle_operation_status;
CREATE POLICY "authenticated_all_access" ON public.vehicle_operation_status
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- shifts
DROP POLICY IF EXISTS "authenticated_all_access" ON public.shifts;
CREATE POLICY "authenticated_all_access" ON public.shifts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- employees
DROP POLICY IF EXISTS "authenticated_all_access" ON public.employees;
CREATE POLICY "authenticated_all_access" ON public.employees
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ===== 確認用クエリ =====
-- 適用後に以下を実行して全テーブルが secure になっていることを確認:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
