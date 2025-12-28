-- 待機場所住所カラムを追加
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiting_location_address TEXT;

