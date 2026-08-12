# Research & Design Decisions

## Summary
- **Feature**: `line-order-intake`
- **Discovery Scope**: Complex Integration（既存配車・予約台帳・LINE push への横断拡張）
- **Key Findings**:
  - 顧客向け LIFF / Webhook / userId push は未実装。グループ push のみ実績あり
  - 最短枠探索・Directions は SPA 側に存在。Edge への移植と `shared/` 化が必要
  - 予約台帳と配車ボードは非連携。LINE 振り分けの正本テーブルが必要
  - 可否判定はルール＋Maps。LLM は不要（運用コストも Maps/LINE 中心）

## Research Log

### 既存 LINE 連携
- **Context**: 顧客＋グループ同一チャネル運用の可否
- **Sources Consulted**: `supabase/functions/daily-close`, `reservation-day-notify`, LINE Developers グループトーク文書, `docs/daily-close.md`, `docs/line-order-integration.md`
- **Findings**:
  - 同一チャネルで `to: userId` と `to: groupId` の push が可能
  - Webhook 有効化時はグループ発言も届くためフィルタ必須
  - Secrets: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_GROUP_ID` 既存。`LINE_CHANNEL_SECRET`, `LINE_LIFF_ID` 追加
- **Implications**: 公式アカウント分割は不要。署名検証付き Webhook Edge を新設

### 配車・バッファ
- **Context**: 「バッファ込み最短お迎え」
- **Sources Consulted**: `src/lib/orderPlacement.js`, `src/utils/slotUtils.js`, `src/services/routeService.js`, `docs/line-order-integration.md`
- **Findings**:
  - `findAutoPlacementSlot` / `findEarliestAvailableSlotAcrossVehicles` が再利用候補
  - 現状 `calculateBuffer()` が一律 0 の可能性あり → 要件のバッファと突合が必要
  - 自動仮配置はブラウザ内のみ
- **Implications**: 配置ロジックを `shared/` へ抽出し Edge と SPA で共用。バッファ式は設計で明示し実装前に現行値を確認

### 予約台帳ギャップ
- **Context**: 当日以外を台帳へ
- **Sources Consulted**: `.kiro/specs/reservation-ledger/*`, `reservations` マイグレーション
- **Findings**: ステータスなし・削除のみ・顧客 LINE 非対応・orders 非連携
- **Implications**: LINE 用ステートマシンは新テーブルを正本にし、台帳／配車へ投影するハイブリッドが安全

### Messaging / Maps 料金（運用コスト）
- **Context**: 運用コスト見積
- **Sources Consulted**: LINE Messaging API 料金ページ、LINEヤフー追加メッセージ改定（2026-10）、Google Maps Platform 料金
- **Findings**:
  - LINE: コミュ0円/200通、ライト5,000円/5,000通、スタ15,000円/30,000通。追加はスタンダードのみ（〜3円/通、2026-10以降も追加枠は従量）
  - Maps: Directions / Places Autocomplete は従量。Autocomplete はセッション課金推奨
  - LLM は本機能の可否判定に不要
- **Implications**: 小規模ならライト〜スタンダード。Maps は月数百〜数千円規模が見込み（件数次第）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks | Notes |
|--------|-------------|-----------|-------|-------|
| A. orders/reservations のみ拡張 | 既存2系統に LINE 列を足す | テーブル少 | ステートが分裂、台帳 Non-Goal 破壊 | 非推奨 |
| B. LINE 専用正本＋投影 | `line_bookings` / units を正本、当日→orders、他→reservations | 状態機械が単一 | 投影同期の実装コスト | **採用** |
| C. 完全別システム | LINE だけで完結 | 隔離 | 配車ボードと二重管理 | 非推奨 |

## Design Decisions

### Decision: LINE 予約の正本テーブル
- **Context**: 仮受付・ホールド・台ごと承認・割引を一貫管理したい
- **Alternatives**: A/B/C 上記
- **Selected Approach**: B。ヘッダ＋台単位の LINE 正本。当日は `orders`+`dispatch_slots`、非当日は `reservations` へリンク／同期
- **Rationale**: 既存台帳の「ステータスなし」制約を壊さず、配車オペにも載せる
- **Trade-offs**: 同期コードが増える／単一クエリで全部は見えない
- **Follow-up**: 投影失敗時の補償（再試行・管理画面アラート）

### Decision: 承認は管理画面＋固定 PIN
- **Context**: 誰でも承認、共有6桁
- **Selected Approach**: SPA 管理画面のみ。PIN はサーバー側ハッシュ検証。Supabase Auth とは分離可（ログイン済み運用を推奨）
- **Rationale**: グループ返信パースより安全・単純
- **Trade-offs**: スマホから管理画面を開く一手間

### Decision: 仮想余裕枠は計算上のみ
- **Selected Approach**: capacity = operatingCount + extraCapacity。vehicles 自動作成なし。要手配フラグ
- **Rationale**: ボード汚れ防止。運用で実車手配

### Decision: ホールド期限
- **Selected Approach**: 営業時間内(≥19:00)は15分。それ以外は次の19:00。cron/Edge で期限切れ処理
- **Rationale**: ユーザー確定方針

### Decision: バッファ
- **Selected Approach**: Directions 所要＋既存 `calculateBuffer` 契約を共用。実装時に現行が0なら要件どおりの式へ戻す／設定化するタスクを含める
- **Rationale**: 「バッファ込み」は必須要件

## Risks & Mitigations
- 電話優先ロックの表現不足 — orders/slots と明示ロックテーブルのどちらにするか実装前に確認。暫定は既存 CONFIRMED/TENTATIVE と手動ロックフラグ
- 投影不整合 — 正本を LINE テーブルに固定し、投影は冪等 upsert
- LINE 通数超過 — リマインドは1通設計、プラン監視
- PIN 漏洩 — ハッシュ保存・変更手段・失敗回数制限
- buffer=0 — 実装キックオフで実測・修正

## Gap Analysis Snapshot（validate-gap）

| 領域 | 現状 | 不足 |
|------|------|------|
| LIFF/Webhook | なし | 新規 |
| グループ push | あり | userId push 追加 |
| 最短枠 | SPA のみ | shared + Edge |
| 予約台帳 | 独立メモ | LINE 投影・ステータス相当は正本側 |
| 稼働台数設定 | なし | 曜日別想定＋extra |
| PIN 承認 | なし | 新規 |
| 割引 | なし | 設定＋適用 |
| 顧客リマインド | なし | cron |

**推奨実装アプローチ**: Hybrid（Option B）— 新ドメイン＋既存投影。

## References
- https://developers.line.biz/ja/docs/messaging-api/pricing/
- https://developers.line.biz/ja/docs/messaging-api/group-chats/
- https://developers.line.biz/ja/docs/liff/
- https://www.lycbiz.com/jp/news/line-official-account/20260216/
- 内部: `docs/line-order-integration.md`, `docs/daily-close.md`
