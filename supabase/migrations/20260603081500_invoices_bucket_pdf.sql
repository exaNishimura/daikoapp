-- 請求書を xlsx → pdf に切り替えに伴い、invoices バケットの allowed_mime_types を
-- pdf に更新する。

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'invoices';
