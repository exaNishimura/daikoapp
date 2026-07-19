-- 予約当日スタッフ LINE 通知 cron（19:00 JST = 10:00 UTC）
-- Dashboard → Integrations → Cron、または SQL Editor で実行。
-- YOUR_CRON_SECRET / PROJECT_REF を置き換えること。

-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'reservation-day-notify-19jst',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltwekvgqfawkykpvviyx.supabase.co/functions/v1/reservation-day-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
