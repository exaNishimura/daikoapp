-- daily_sales を 2号車運用 + 人件費管理に対応した形に変更:
--   - vehicle3_sales 列を削除 (3号車は使わない)
--   - labor_cost 列を追加 (1日あたりの人件費総額)
--   - GENERATED 列 total_sales / profit を再定義
-- GENERATED 列に依存する索引・参照が無いことを前提とした単純な再生成。

BEGIN;

-- 既存の GENERATED 列を一旦落とす (定義変更不可のため)
ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS profit;
ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS total_sales;

-- vehicle3_sales を削除
ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS vehicle3_sales;

-- 人件費列を追加 (デフォルト 0 / 非負)
ALTER TABLE public.daily_sales
  ADD COLUMN IF NOT EXISTS labor_cost INTEGER NOT NULL DEFAULT 0
    CHECK (labor_cost >= 0);

-- 再計算した総売上 / 利益
ALTER TABLE public.daily_sales
  ADD COLUMN total_sales INTEGER GENERATED ALWAYS AS
    (vehicle1_sales + vehicle2_sales) STORED;

ALTER TABLE public.daily_sales
  ADD COLUMN profit INTEGER GENERATED ALWAYS AS (
    (vehicle1_sales + vehicle2_sales)
    - expense_amount
    - COALESCE(vehicle1_fuel_yen, 0)
    - COALESCE(vehicle2_fuel_yen, 0)
    - labor_cost
  ) STORED;

COMMIT;
