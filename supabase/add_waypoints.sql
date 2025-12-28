-- 経由地カラムを追加（JSON配列形式）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waypoints JSONB DEFAULT '[]'::jsonb;

-- インデックスを追加（検索用）
CREATE INDEX IF NOT EXISTS idx_orders_waypoints ON orders USING GIN (waypoints);

