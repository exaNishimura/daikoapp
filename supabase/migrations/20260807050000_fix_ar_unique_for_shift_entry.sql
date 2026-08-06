-- =============================================================================
-- 20260807050000_fix_ar_unique_for_shift_entry.sql
--
-- accounts_receivable の業務キー UNIQUE を撤廃する。
--
-- 旧 UNIQUE:
--   (billing_month, company_id, work_date, departure, destination, amount)
--   NULLS NOT DISTINCT
--
-- シフト表運用では「同日・同請求先・同金額」の複数行があり得る
-- （号車違い・同じ号車で別件・備考なしの同額など）。
-- departure / destination が常に NULL のシフト入力では、
-- 旧制約が実質 (月, 請求先, 日, 金額) 一意になり正当な入力を弾いていた。
--
-- Excel インポートのマージ (ON CONFLICT DO NOTHING) は PK 以外の
-- 衝突対象が無くなるため、同一内容も追加挿入される。
-- 上書きインポート (先に DELETE) の挙動は変わらない。
-- =============================================================================

ALTER TABLE public.accounts_receivable
  DROP CONSTRAINT IF EXISTS accounts_receivable_billing_month_company_id_work_date_depa_key;

ALTER TABLE public.accounts_receivable
  DROP CONSTRAINT IF EXISTS accounts_receivable_unique_line;
