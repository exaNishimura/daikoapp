-- 代行運転配車システム データベーススキーマ
-- Supabase SQL Editorで実行してください

-- vehiclesテーブル
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);

-- ordersテーブル
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('NOW', 'SCHEDULED')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  contact_phone VARCHAR(20),
  car_model VARCHAR(50),
  car_plate VARCHAR(10),
  car_color VARCHAR(20),
  parking_note TEXT,
  base_duration_min INT,
  buffer_min INT,
  buffer_manual BOOLEAN DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'UNASSIGNED' CHECK (status IN ('UNASSIGNED', 'TENTATIVE', 'CONFIRMED', 'CANCELLED')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- dispatch_slotsテーブル
CREATE TABLE IF NOT EXISTS dispatch_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'TENTATIVE' CHECK (status IN ('TENTATIVE', 'CONFIRMED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_slots_vehicle_time ON dispatch_slots(vehicle_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_slots_order ON dispatch_slots(order_id);
CREATE INDEX IF NOT EXISTS idx_slots_status ON dispatch_slots(status);

-- updated_at自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- vehiclesテーブルのupdated_atトリガー
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ordersテーブルのupdated_atトリガー
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- dispatch_slotsテーブルのupdated_atトリガー
CREATE TRIGGER update_dispatch_slots_updated_at
  BEFORE UPDATE ON dispatch_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 初期データ: 車両（1号車、2号車）
INSERT INTO vehicles (name, sort_order) VALUES
  ('1号車', 1),
  ('2号車', 2)
ON CONFLICT DO NOTHING;

-- Row Level Security (RLS) を無効化（MVPでは全アクセス許可）
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_slots DISABLE ROW LEVEL SECURITY;

