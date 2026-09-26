-- 自社ごとの予約開始・営業開始。初期値は予約 19時 / 営業 20時。
-- 終了は翌 06:00 のまま（アプリ側 BUSINESS_END_HOUR）。開始は 7〜23 時。

ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS reservation_start_hour SMALLINT NOT NULL DEFAULT 19;

ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS business_start_hour SMALLINT NOT NULL DEFAULT 20;

ALTER TABLE public.company_profile
  DROP CONSTRAINT IF EXISTS company_profile_reservation_start_hour_check;

ALTER TABLE public.company_profile
  ADD CONSTRAINT company_profile_reservation_start_hour_check
  CHECK (reservation_start_hour BETWEEN 7 AND 23);

ALTER TABLE public.company_profile
  DROP CONSTRAINT IF EXISTS company_profile_business_start_hour_check;

ALTER TABLE public.company_profile
  ADD CONSTRAINT company_profile_business_start_hour_check
  CHECK (business_start_hour BETWEEN 7 AND 23);
