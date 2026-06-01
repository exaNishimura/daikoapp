-- =============================================================================
-- 20260602030500_seed_receivable_billing.sql
--
-- receivable-billing 機能の初期データ投入。
-- スキーマは 20260602030000_add_receivable_billing_schema.sql を参照。
--
-- 投入内容:
--   - company_profile (1 行、自社固定情報)
--   - staff_rates     (9 行、source-prompt.md の単価表)
--   - companies       (15 行、2026/5 実データから抽出した取引先マスタ)
--
-- すべて ON CONFLICT DO NOTHING で再実行安全。
-- =============================================================================

-- ===== company_profile =====
INSERT INTO public.company_profile (
  id, name, postal_code, address, invoice_number,
  bank, bank_branch, bank_account_type, bank_account_number, bank_account_holder
) VALUES (
  1,
  '運転代行 チョロ急',
  '513-0844',
  '三重県鈴鹿市平田1-2-36 City Life A',
  'T6810612966358',
  '百五銀行',
  '鈴鹿支店',
  '普通預金',
  '1074556',
  '朝魯們（チョロ モン）'
)
ON CONFLICT (id) DO NOTHING;

-- ===== staff_rates =====
INSERT INTO public.staff_rates
  (staff_name, rate_type, hourly_rate, commission_rate, display_order)
VALUES
  ('チョロモン', 'commission', NULL, 0.300, 1),
  ('井上',       'hourly',     1150, NULL,  2),
  ('伊藤',       'hourly',     1300, NULL,  3),
  ('西村',       'hourly',     1300, NULL,  4),
  ('たかし',     'hourly',     1100, NULL,  5),
  ('しゅうや',   'hourly',     1100, NULL,  6),
  ('山崎',       'hourly',     1100, NULL,  7),
  ('臨時1',      'hourly',     1100, NULL,  8),
  ('臨時2',      'hourly',     1000, NULL,  9)
ON CONFLICT (staff_name) DO NOTHING;

-- ===== companies =====
-- 2026/5 売掛シートから抽出した実取引先 15 社。
-- invoice_display_name は請求書テンプレに刷り込む正式名称。
-- aliases は集計時の表記ゆれ吸収。
INSERT INTO public.companies
  (name, invoice_display_name, aliases, display_order)
VALUES
  ('徳丸',                NULL,                    '{}',                                       1),
  ('三重パーツ',          NULL,                    '{}',                                       2),
  ('法寿園',              NULL,                    '{}',                                       3),
  ('アステル塗健',        NULL,                    '{}',                                       4),
  ('蝶々',                NULL,                    '{}',                                       5),
  ('草深創建',            NULL,                    '{}',                                       6),
  ('山央工業',            NULL,                    '{}',                                       7),
  ('美濃建設',            NULL,                    '{}',                                       8),
  ('チョロモン',          NULL,                    '{}',                                       9),
  ('鈴友',                '株式会社 鈴友',         ARRAY['株式会社 鈴友', '(株)鈴友'],          10),
  ('ラウンジ心',          NULL,                    '{}',                                      11),
  ('（株）ＵＥＴＡＫＡ',   NULL,                    ARRAY['UETAKA'],                           12),
  ('モアライド',          NULL,                    '{}',                                      13),
  ('Biss',                NULL,                    '{}',                                      14),
  ('ゾンテック（株）',    NULL,                    ARRAY['ゾンテック'],                       15)
ON CONFLICT (name) DO NOTHING;
