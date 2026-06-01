# Supabase 関連ファイル

## ディレクトリ構成

```
supabase/
├── README.md                 ← このファイル
├── migrations/               ← 公式 migration (Supabase CLI / MCP で適用)
│   ├── 20260101000000_initial_schema.sql
│   ├── 20260601125210_001_enable_rls.sql
│   ├── 20260601125210_001_enable_rls_rollback.sql
│   ├── 20260602030000_add_receivable_billing_schema.sql
│   ├── 20260602030500_seed_receivable_billing.sql
│   └── 20260602030500_add_invoice_rpc.sql
└── legacy/                   ← 旧 patch SQL (動作上の意味は initial_schema に統合済み)
    ├── schema.sql
    ├── add_*.sql
    └── ...
```

## 命名規則

新しい migration を追加するときは

```
supabase/migrations/<UTC timestamp YYYYMMDDHHMMSS>_<snake_case_description>.sql
```

の形式にする。Supabase CLI / MCP の `apply_migration` がこのタイムスタンプ順に
適用するため、必ず単調増加させる。

## ファイル一覧

### `migrations/20260101000000_initial_schema.sql`

ベースラインスキーマ。空 DB から daikoapp が動く状態を 1 ファイルで作る。
内容:

- 6 テーブル: `vehicles`, `orders`, `dispatch_slots`,
  `vehicle_operation_status`, `employees`, `shifts`
- `update_updated_at_column()` トリガー関数 + 各テーブル分のトリガー
- 主要インデックス
- 初期データ: `vehicles` (1号車 / 2号車)

冪等 (`CREATE TABLE IF NOT EXISTS` / `DROP TRIGGER IF EXISTS`)。

> 既存本番 DB はこのファイルが作られる前に手動 SQL で同等の状態に到達済み
> なので、本番への `apply_migration` は **しない**。新環境のセットアップや
> ローカル `supabase db reset` 用のリファレンスとして使う。

### `migrations/20260601125210_001_enable_rls.sql`

全テーブルに RLS を有効化し、以下のポリシーを設定:

- 配車系 (`vehicles` / `orders` / `dispatch_slots` / `vehicle_operation_status`)
  → `anon` + `authenticated` に全権
- `shifts` / `employees`
  → SELECT は誰でも可、書き込みは `authenticated` のみ

ロールバックは同フォルダの `20260601125210_001_enable_rls_rollback.sql`。

### `migrations/20260602030000_add_receivable_billing_schema.sql`

`receivable-billing` 機能 (.kiro/specs/receivable-billing/) のスキーマ追加。
8 テーブル + index + trigger + RLS:

- `company_profile` (シングルトン)
- `companies` (取引先マスタ)
- `invoices` (請求書ヘッダ)
- `accounts_receivable` (売掛明細)
- `daily_sales` (日次売上集計、`total_sales` / `profit` は GENERATED 列)
- `daily_staff_sales` (スタッフ別日次売上)
- `staff_rates` (スタッフ単価マスタ)
- `monthly_fixed_expenses` (月額固定経費)

すべての RLS は `authenticated` のみ full access。`anon` は一切アクセス不可
(売上・売掛は機密情報のため)。

### `migrations/20260602030500_seed_receivable_billing.sql`

上記スキーマの初期データ:

- `company_profile`: 1 行 (運転代行 チョロ急 / 鈴鹿市平田 / インボイス T6810612966358 / 百五銀行)
- `staff_rates`: 9 行 (チョロモン=歩合 0.300、井上 ¥1,150、伊藤 ¥1,300、西村 ¥1,300、たかし/しゅうや/山崎/臨時1 ¥1,100、臨時2 ¥1,000)
- `companies`: 15 行 (2026/5 売掛シートから抽出した実取引先)

全件 `ON CONFLICT DO NOTHING` で再実行安全。

### `migrations/20260602030500_add_invoice_rpc.sql`

請求書発行・取消・入金記録の RPC 3 種:

- `issue_invoice(company_id, billing_month, issue_date, total_amount, line_count, profile_snapshot, file_path)`
  - 当月・当社の未請求売掛集計が引数と一致するかを検算 (`line_count` / `total_amount`)
  - `invoices` insert + `accounts_receivable.invoice_id` を 1 トランザクションで一括更新
  - 同月二重発行は `invoices.UNIQUE(company_id, billing_month)` で防止
- `revoke_invoice(invoice_id)`
  - 未入金 invoices を削除し、紐付いていた `accounts_receivable.invoice_id` を NULL に戻す
  - 入金済の場合はエラー
- `mark_invoice_paid(invoice_id, paid_at)`
  - `invoices.paid_at` をセット (再入金は禁止)

すべて `SECURITY INVOKER` (RLS は呼び出しユーザーに従う)、`authenticated` のみ
EXECUTE 権限、`anon` / `PUBLIC` は REVOKE。

## Storage バケット (手動作成)

`receivable-billing` 機能は発行済み請求書 .xlsx を Supabase Storage に保存する。
MCP からはバケット作成 API が無いため、以下を Supabase Dashboard で手動実行する:

1. Project → Storage → "New bucket"
2. Name: `invoices`
3. Public bucket: **OFF** (private)
4. File size limit: 10 MB
5. Allowed MIME types: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

ポリシーは Storage → Policies から:

- `invoices` バケットに対し、`authenticated` ロールに `INSERT` / `SELECT` / `UPDATE` / `DELETE` を許可
- `anon` は一切付与しない

ファイルパスの命名規則: `invoices/YYYY/MM/{company_id}-{display_name}.xlsx`

## 新環境セットアップ手順 (例)

1. 新しい Supabase プロジェクトを作る
2. SQL Editor またはマイグレーション順に以下を実行
   - `20260101000000_initial_schema.sql`
   - `20260601125210_001_enable_rls.sql`
   - `20260602030000_add_receivable_billing_schema.sql`
   - `20260602030500_seed_receivable_billing.sql`
   - `20260602030500_add_invoice_rpc.sql`
3. Supabase Auth で管理者ユーザーを 1 人作る
4. Storage で `invoices` バケットを上記手順で作成
5. `vehicle_operation_status` / `shifts` / `employees` の初期データは
   アプリ UI 経由で投入

## 旧 `legacy/`

`schema.sql` 等は本番 DB がこの形になるまでの履歴。新ベースラインに統合済み
なので普段は読まなくてよいが、過去の意思決定を辿りたいときに残してある。
