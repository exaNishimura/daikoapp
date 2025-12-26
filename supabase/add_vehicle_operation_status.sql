-- vehicle_operation_statusテーブルの作成
-- Supabase SQL Editorで実行してください

-- vehicle_operation_statusテーブル
CREATE TABLE IF NOT EXISTS vehicle_operation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('DEFAULT', 'DAY_OFF', 'STOP', 'START')),
  date DATE NOT NULL,
  time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_time_required CHECK (
    (type IN ('STOP', 'START') AND time IS NOT NULL) OR
    (type = 'DAY_OFF' AND time IS NULL) OR
    (type = 'DEFAULT' AND time IS NULL)
  ),
  CONSTRAINT unique_vehicle_date_type UNIQUE (vehicle_id, date, type)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_vehicle_operation_status_vehicle_date ON vehicle_operation_status(vehicle_id, date);
CREATE INDEX IF NOT EXISTS idx_vehicle_operation_status_date ON vehicle_operation_status(date);

-- updated_at自動更新トリガー
CREATE TRIGGER update_vehicle_operation_status_updated_at
  BEFORE UPDATE ON vehicle_operation_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) を無効化（MVPでは全アクセス許可）
ALTER TABLE vehicle_operation_status DISABLE ROW LEVEL SECURITY;

