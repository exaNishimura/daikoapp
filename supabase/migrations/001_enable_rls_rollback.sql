-- 001_enable_rls_rollback.sql
-- 緊急時に 001_enable_rls.sql を巻き戻す。
-- ログイン機能が壊れたときに anon キーでもアクセス可能な状態に戻す。
-- 適用後はセキュリティ的に脆弱な状態になるので、復旧後すぐに再適用すること。

-- 配車関連
DROP POLICY IF EXISTS "public_all_access" ON public.vehicles;
DROP POLICY IF EXISTS "public_all_access" ON public.orders;
DROP POLICY IF EXISTS "public_all_access" ON public.dispatch_slots;
DROP POLICY IF EXISTS "public_all_access" ON public.vehicle_operation_status;

-- シフト/従業員
DROP POLICY IF EXISTS "public_read" ON public.shifts;
DROP POLICY IF EXISTS "authenticated_write" ON public.shifts;
DROP POLICY IF EXISTS "public_read" ON public.employees;
DROP POLICY IF EXISTS "authenticated_write" ON public.employees;

ALTER TABLE public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_operation_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
