-- 全車両にデフォルトの待機場所住所を設定
UPDATE vehicles 
SET waiting_location_address = '三重県鈴鹿市平田新町2-20'
WHERE waiting_location_address IS NULL OR waiting_location_address = '';

