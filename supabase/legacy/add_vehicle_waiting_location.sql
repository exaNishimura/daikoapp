-- 車両テーブルに待機場所住所カラムを追加
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS waiting_location_address TEXT;

-- 既存の車両にデフォルトの待機場所住所を設定
UPDATE vehicles 
SET waiting_location_address = '三重県鈴鹿市平田新町2-20'
WHERE waiting_location_address IS NULL OR waiting_location_address = '';

