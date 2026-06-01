-- Row Level Security (RLS) を無効化
-- Supabase SQL Editorで実行してください
-- MVPでは全アクセス許可のため、RLSを無効化します

ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_slots DISABLE ROW LEVEL SECURITY;

-- RLSの状態を確認（オプション）
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('vehicles', 'orders', 'dispatch_slots')
ORDER BY tablename;

