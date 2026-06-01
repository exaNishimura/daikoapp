-- shiftsテーブルの作成
-- Supabase SQL Editorで実行してください

-- shiftsテーブル
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  dow VARCHAR(10) NOT NULL,
  car VARCHAR(10),
  role VARCHAR(10) CHECK (role IN ('代行', '随伴')),
  staff VARCHAR(50),
  start TIME,
  "end" TIME,
  note TEXT,
  status VARCHAR(20) CHECK (status IN ('休業', '定休日')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_date_car ON shifts(date, car);

-- updated_at自動更新トリガー
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) を無効化（MVPでは全アクセス許可）
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;

