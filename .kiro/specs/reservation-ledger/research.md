# Research & Design Decisions

## Summary
- **Feature**: `reservation-ledger`
- **Discovery Scope**: Extension（既存 SPA + Supabase + 日次締め LINE Edge Function の拡張）
- **Key Findings**:
  - LINE push / リトライ / 失敗メール / cron 認可は `supabase/functions/daily-close` に完成形がある
  - シフト表の日付行は `day-header-date-row`（`.day-date` 隣）がバッジ挿入点として最小侵食
  - データ層は `components → hooks → services → supabase` と `queryKeys` 集約が既定パターン

## Research Log

### 既存 LINE 通知パターン
- **Context**: Req 6（当日スタッフ LINE）を日次締めと同系統で実装するため
- **Sources Consulted**: `supabase/functions/daily-close/index.ts`, `docs/daily-close.md`
- **Findings**:
  - `CRON_SECRET` Bearer 認可
  - Messaging API `push`、最大 3 リトライ、失敗時 Resend メール
  - 冪等は `daily_close_notifications` / `daily_day_closures` の `work_date` 一意
  - Secrets: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_GROUP_ID`, Resend 系
- **Implications**: 新規 Edge Function `reservation-day-notify` で同パターンを踏襲。19:00 JST = cron `0 10 * * *`（UTC）

### シフト表 UI 挿入点
- **Context**: Req 5 + Open Q3（件数バッジ → クリックで一覧）
- **Sources Consulted**: `src/components/ShiftCalendar.jsx`（`DayBlock` / `day-header-date-row`）
- **Findings**: 日付ラベル隣にステータスバッジ（締め済・休業）が既にある。同列への件数バッジ追加が最小変更
- **Implications**: 新規子コンポーネント `ReservationDayBadge` + MUI Menu/Popover。シフト本体ロジックは触らない

### RLS / 認証方針
- **Context**: 電話番号を含む予約データの公開範囲
- **Sources Consulted**: `supabase/migrations/20260601125210_001_enable_rls.sql`, receivable 系 public write 緩和マイグレーション
- **Findings**: 配車系は anon 書込み可。シフトは public read / authenticated write。請求系は当初 authenticated のみ
- **Implications**: 予約は PII のため **shifts と同型（SELECT: anon+authenticated、書込み: authenticated）**。台帳画面は `requiresAuth: true`

### 受付開始 19:00 と通知対象ウィンドウ
- **Context**: ユーザー指定「当日の受付開始時間である 19 時」
- **Findings**: 暦日だけで取ると 0:00〜6:00 の予約は「その暦日の 19:00」通知になり事後通知になる
- **Implications**: 19:00 実行時の対象は **営業夜ウィンドウ** `[D 19:00, (D+1) 06:00)`（Asia/Tokyo）とする。シフト表の「その日」表示は予約の暦日（`reserved_at` の JST 日付）でグループ（タイムライン日付と整合）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. 独立テーブル + 独立 EF | `reservations` + `reservation-day-notify` | 配車と完全分離、日次締め非侵襲 | EF の LINE 送信コード重複 | **採用** |
| B. orders 拡張 | 予約を orders の一種に | 配車再利用 | Non-Goal 違反、ステータス汚染 | 不採用 |
| C. daily-close に同居 | 8:00 締めに予約も載せる | cron 1 本 | 時刻が 19:00 要件と不一致 | 不採用 |

## Design Decisions

### Decision: 通知時刻と対象ウィンドウ
- **Context**: Open Q1（19:00）、早朝予約の事後通知問題
- **Alternatives Considered**:
  1. 暦日一致のみ
  2. 営業夜 `[D 19:00, (D+1) 06:00)`
- **Selected Approach**: 2
- **Rationale**: 「受付開始 19 時」に備えを知らせる目的と整合
- **Trade-offs**: シフト表の暦日表示と完全一致しない予約（日付跨ぎ）があり得る → バッジは暦日、LINE は営業夜とドキュメント化
- **Follow-up**: 実装時にウィンドウ境界のユニットテスト必須

### Decision: 0 件時はスキップ
- **Context**: Open Q2
- **Selected Approach**: 送信せず、`reservation_day_notifications` に `skipped=true` で冪等記録
- **Rationale**: ノイズ削減 + 多重送信防止

### Decision: シフト UI は件数バッジ + ポップオーバー
- **Context**: Open Q3
- **Selected Approach**: `day-header-date-row` に件数バッジ。クリックで時刻・顧客名一覧、`/reservations?date=` へリンク
- **Rationale**: 既存レイアウト最小侵食、Req 5.4 導線も満たす

### Decision: 顧客 LINE は別経路（未実装）
- **Context**: Req 8.3
- **Selected Approach**: スタッフ通知 EF に顧客送信を混ぜない。将来 `reservation-customer-remind` + 顧客識別子列を別マイグレーションで追加可能にする（今は列なし）
- **Rationale**: チャネル・同意・失敗ハンドリングが異なる

## Risks & Mitigations
- LINE 文字数上限 — 本文を時刻+氏名+電話+メモ要約に制限し、件数多い場合は先頭 N 件 + 「他 M 件は台帳で確認」
- 認証必須による登録摩擦 — ナビは auth 必須。運用でマジックリンクログイン済み端末を使う
- シフト表の月次ロードに予約クエリ追加 — `byMonth` 一括取得で N+1 回避
- daily-close との Secrets 共有 — 同じ `LINE_*` / Resend / `CRON_SECRET` を再利用（新規 secret 不要）

## References
- [LINE Messaging API push](https://developers.line.biz/ja/reference/messaging-api/#send-push-message)
- 内部: `docs/daily-close.md`, `docs/line-order-integration.md`
- Steering: `.kiro/steering/tech.md`, `structure.md`
