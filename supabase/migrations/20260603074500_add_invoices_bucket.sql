-- invoices Storage バケット + RLS ポリシー
-- 旧仕様: Supabase Dashboard で手動作成していたものを冪等な SQL に置き換え。
-- private / 10MB / xlsx 限定。authenticated のみ全権、anon は不可。

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  FALSE,
  10485760,
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 既存ポリシーがあれば作り直す (冪等)
DROP POLICY IF EXISTS "invoices_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "invoices_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "invoices_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "invoices_authenticated_delete" ON storage.objects;

CREATE POLICY "invoices_authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "invoices_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "invoices_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "invoices_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');
