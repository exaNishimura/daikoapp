-- ordersテーブルにpickup_locationカラムを追加
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS pickup_location TEXT;

-- 既存のデータがある場合、pickup_locationをNULLのままにする（任意フィールド）

