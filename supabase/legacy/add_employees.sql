-- employeesテーブルの作成
-- Supabase SQL Editorで実行してください

-- employeesテーブル
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  license_type VARCHAR(10) NOT NULL CHECK (license_type IN ('一種', '二種')),
  color VARCHAR(7) NOT NULL, -- カラーコード（例: #FFA500）
  hourly_wage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_employee_name UNIQUE(name)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_sort_order ON employees(sort_order);

-- updated_at自動更新トリガー
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) を無効化（MVPでは全アクセス許可）
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- 初期データ: 既存のスタッフを登録
INSERT INTO employees (name, license_type, color, hourly_wage, sort_order) VALUES
  ('西村', '一種', '#FFA500', 0, 1),
  ('鈴木', '一種', '#FFD700', 0, 2),
  ('チョロモン', '一種', '#8A2BE2', 0, 3),
  ('たかし', '二種', '#00BFFF', 0, 4),
  ('なみ', '二種', '#FF69B4', 0, 5),
  ('しゅうや', '一種', '#32CD32', 0, 6)
ON CONFLICT (name) DO NOTHING;
