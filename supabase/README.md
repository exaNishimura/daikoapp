# Supabase 関連ファイル

## ディレクトリ構成

```
supabase/
├── README.md                 ← このファイル
├── migrations/               ← 公式 migration (Supabase CLI / MCP で適用)
│   ├── 20260101000000_initial_schema.sql
│   ├── 20260601125210_001_enable_rls.sql
│   └── 20260601125210_001_enable_rls_rollback.sql
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

## 新環境セットアップ手順 (例)

1. 新しい Supabase プロジェクトを作る
2. SQL Editor で `migrations/20260101000000_initial_schema.sql` を実行
3. 続いて `migrations/20260601125210_001_enable_rls.sql` を実行
4. Supabase Auth で管理者ユーザーを 1 人作る
5. `vehicle_operation_status` / `shifts` / `employees` の初期データは
   アプリ UI 経由で投入

## 旧 `legacy/`

`schema.sql` 等は本番 DB がこの形になるまでの履歴。新ベースラインに統合済み
なので普段は読まなくてよいが、過去の意思決定を辿りたいときに残してある。
