-- 確定後のステータスを追加
-- Supabase SQL Editorで実行してください

-- ordersテーブルのstatus制約を更新
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'UNASSIGNED', 
    'TENTATIVE', 
    'CONFIRMED', 
    'ARRIVED',        -- 現地到着
    'PICKING_UP',     -- 客車引取
    'IN_TRANSIT',     -- 送客中
    'COMPLETED',      -- 送客完了
    'CANCELLED'
  ));

