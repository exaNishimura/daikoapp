# 日次締め（8時 LINE 通知 + 編集ロック）

## 概要

毎朝 **8:00 JST** に前日分（`work_date` = 昨日）を締め、LINE グループへ集計結果を送信する。

- 休業・定休日は **スキップ**
- 稼働号車で未入力があれば **⚠ 未入力** 警告付きで送信
- LINE 送信失敗時は **3回リトライ** → 失敗なら **メール通知**（締めは行わない）
- 締め後は匿名ユーザーは編集不可。**ログイン済み管理者** は編集可（RLS）

## セットアップ

### 1. DB マイグレーション

```powershell
supabase db push
```

### 2. Edge Function デプロイ

```powershell
supabase functions deploy daily-close --no-verify-jwt
```

### 3. シークレット登録

```powershell
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="（トークン）"
supabase secrets set LINE_GROUP_ID="Ceee2ca4387e89ae2ae1f85b1d0d4962c"
supabase secrets set CRON_SECRET="（ランダムな長い文字列）"
supabase secrets set RESEND_API_KEY="re_xxxx"
supabase secrets set ALERT_EMAIL_FROM="notifications@your-domain.com"
supabase secrets set ALERT_EMAIL_TO="admin@example.com"
```

### 4. 8時 cron（Supabase Dashboard）

Dashboard の場所: **Integrations → Cron**（Database 配下ではない）

https://supabase.com/dashboard/project/ltwekvgqfawkykpvviyx/integrations/cron/jobs

1. **Create job**
2. Name: `daily-close-8am-jst`
3. Schedule: `0 23 * * *`（UTC 23:00 = JST 08:00）
4. Type: **HTTP request** または **Supabase Edge Function** → `daily-close`
5. Method: POST
6. Headers: `Authorization: Bearer <CRON_SECRET>`

`pg_net` が必要な場合は **Database → Extensions** で有効化。

#### SQL で設定する場合（UI が見つからないとき）

Dashboard → **SQL Editor** で実行:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'daily-close-8am-jst',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ltwekvgqfawkykpvviyx.supabase.co/functions/v1/daily-close',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

`YOUR_CRON_SECRET` は `supabase secrets set` した値に置き換える。

### 5. 手動実行

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://ltwekvgqfawkykpvviyx.supabase.co/functions/v1/daily-close" `
  -Headers @{ Authorization = "Bearer your_cron_secret" } `
  -ContentType "application/json" `
  -Body '{"work_date":"2026-07-09"}'
```

## Resend（失敗メール）

https://resend.com で API Key 発行・送信ドメイン検証が必要。

## LINE 公式アカウント

1. https://manager.line.biz/ でアカウント作成
2. Messaging API 有効化
3. 「グループトーク・複数人トークへの参加を許可」を ON
4. トークン発行・グループへボット招待
5. グループ ID: `Ceee2ca4387e89ae2ae1f85b1d0d4962c`
