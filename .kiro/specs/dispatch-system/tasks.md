# Implementation Plan

## Task Format Template

Use whichever pattern fits the work breakdown:

### Major task only
- [ ] {{NUMBER}}. {{TASK_DESCRIPTION}}{{PARALLEL_MARK}}
  - {{DETAIL_ITEM_1}} *(Include details only when needed. If the task stands alone, omit bullet items.)*
  - _Requirements: {{REQUIREMENT_IDS}}_

### Major + Sub-task structure
- [ ] {{MAJOR_NUMBER}}. {{MAJOR_TASK_SUMMARY}}
- [ ] {{MAJOR_NUMBER}}.{{SUB_NUMBER}} {{SUB_TASK_DESCRIPTION}}{{SUB_PARALLEL_MARK}}
  - {{DETAIL_ITEM_1}}
  - {{DETAIL_ITEM_2}}
  - _Requirements: {{REQUIREMENT_IDS}}_ *(IDs only; do not add descriptions or parentheses.)*

> **Parallel marker**: Append ` (P)` only to tasks that can be executed in parallel. Omit the marker when running in `--sequential` mode.
>
> **Optional test coverage**: When a sub-task is deferrable test work tied to acceptance criteria, mark the checkbox as `- [ ]*` and explain the referenced requirements in the detail bullets.

- [x] 1. プロジェクトセットアップと開発環境構築
- [x] 1.1 (P) 依存関係のインストールと設定
  - package.jsonに必要な依存関係を追加（React, Vite, @dnd-kit/core等）
  - Vite設定ファイルの作成と最適化
  - 開発環境のセットアップと動作確認
  - _Requirements: 1, 2, 3, 4_

- [x] 1.2 (P) プロジェクト構造の作成
  - ディレクトリ構造の作成（components, services, api, db等）
  - パスエイリアス（@/）の設定
  - 基本的なファイル構造の整備
  - _Requirements: 1, 2, 3, 4_

- [x] 2. データベーススキーマとAPI基盤
- [x] 2.1 Supabaseプロジェクトのセットアップとスキーマ実装
  - Supabaseプロジェクトの作成と接続設定
  - @supabase/supabase-jsのインストールと設定
  - vehiclesテーブルの作成（PostgreSQLスキーマ）
  - ordersテーブルの作成（全フィールドと制約、CHECK制約含む）
  - dispatch_slotsテーブルの作成（外部キー制約含む）
  - インデックスの作成と最適化
  - updated_at自動更新トリガーの設定
  - Supabase SQL Editorでのマイグレーション実行
  - _Requirements: 10_

- [x] 2.2 (P) SupabaseクライアントとAPI基盤の構築
  - Supabaseクライアントの初期化（環境変数からURL/Key取得）
  - REST APIエンドポイントの基本構造作成
  - Supabaseクライアントを使用したデータベース操作のラッパー関数
  - エラーハンドリングミドルウェアの実装
  - リクエスト/レスポンスのバリデーション機能
  - CORS設定とセキュリティ対策
  - _Requirements: 10_

- [ ] 3. 依頼管理機能の実装
- [ ] 3.1 依頼作成APIの実装
  - POST /api/ordersエンドポイントの実装
  - リクエストバリデーション（必須項目チェック）
  - データベースへの保存処理
  - 作成時刻の自動記録
  - エラーハンドリングとレスポンス
  - _Requirements: 1, 10_

- [ ] 3.2 (P) 依頼取得APIの実装
  - GET /api/ordersエンドポイントの実装
  - ステータスによるフィルタリング機能
  - 到着順（新しい順）でのソート
  - エラーハンドリング
  - _Requirements: 2, 10_

- [ ] 3.3 (P) 依頼更新APIの実装
  - PATCH /api/orders/:idエンドポイントの実装
  - 部分更新の処理
  - バリデーションとエラーハンドリング
  - _Requirements: 9, 10_

- [ ] 4. ルート計算とバッファ管理機能
- [ ] 4.1 Google Maps API連携の実装
  - Google Maps Directions APIの統合
  - POST /api/route/estimateエンドポイントの実装
  - 出発地・目的地から所要時間を取得する処理
  - API失敗時のnull返却処理
  - エラーハンドリングとリトライロジック
  - _Requirements: 5_

- [ ] 4.2 (P) バッファ計算ロジックの実装
  - バッファ計算関数の実装（buffer = max(5分, ceil(base * 0.15)) + pickup_wait(5分)）
  - base_durationがnullの場合のフォールバック処理（base = 20分）
  - 手動バッファ調整の処理（buffer_manualフラグ）
  - ユニットテストの作成
  - _Requirements: 5_

- [ ] 4.3 依頼作成時のルート計算統合
  - 依頼作成APIにルート計算を統合
  - バックグラウンドでのルート計算処理
  - base_durationとbufferの自動計算と保存
  - エラーハンドリング（ルート取得失敗時の処理）
  - _Requirements: 1, 5_

- [ ] 5. 競合検出機能の実装
- [ ] 5.1 競合検出ロジックの実装
  - 競合判定関数の実装（(startA < endB) && (endA > startB)）
  - 同一vehicle_idでの時間重複チェック
  - クライアント側での競合検出処理
  - ユニットテストの作成
  - _Requirements: 6_

- [ ] 5.2 (P) サーバー側競合検出の実装
  - スロット確定時の競合チェック処理
  - データベースクエリによる競合検出
  - 競合時のエラーレスポンス（409 Conflict）
  - _Requirements: 6_

- [ ] 6. 配車スロット管理機能の実装
- [ ] 6.1 スロット作成APIの実装
  - POST /api/slotsエンドポイントの実装
  - start_atからend_atの自動計算（base_duration + buffer）
  - 依頼ステータスの更新（TENTATIVE）
  - データベースへの保存処理
  - _Requirements: 3, 10_

- [ ] 6.2 スロット更新APIの実装
  - PATCH /api/slots/:idエンドポイントの実装
  - start_at更新時のend_at再計算
  - 車両変更の処理
  - エラーハンドリング
  - _Requirements: 3, 10_

- [ ] 6.3 スロット確定APIの実装
  - POST /api/slots/:id/confirmエンドポイントの実装
  - サーバー側での競合再チェック
  - ステータスの更新（CONFIRMED）
  - エラーハンドリング（競合時の拒否）
  - _Requirements: 6, 7_

- [ ] 6.4 スロット削除APIの実装
  - DELETE /api/slots/:idエンドポイントの実装
  - 依頼ステータスの更新（UNASSIGNED）
  - エラーハンドリング
  - _Requirements: 7, 10_

- [x] 7. UIコンポーネントの実装
- [x] 7.1 DispatchBoardコンポーネントの実装
  - 3ペインレイアウト（左：未割当一覧、中央：タイムライン、右：詳細パネル）
  - ヘッダーに営業日表示と新規依頼ボタン
  - 状態管理（React ContextまたはProps）
  - 各ペイン間の状態同期
  - スタイリング（CSS GridまたはFlexbox）
  - _Requirements: 1, 2, 3, 4, 8, 9_

- [x] 7.2 (P) OrderFormModalコンポーネントの実装
  - モーダル表示機能
  - 必須項目の入力フィールド（予約種別、出発地、目的地）
  - 任意項目の入力フィールド（車情報、連絡先等）
  - 予約種別による日時フィールドの表示/非表示
  - バリデーション（クライアント側）
  - 依頼作成APIの呼び出し
  - エラーハンドリングとフィードバック
  - _Requirements: 1_

- [x] 7.3 (P) OrderCardListコンポーネントの実装
  - 未割当依頼の一覧表示
  - 到着順（新しい順）でのソート
  - ステータスによるフィルタリング
  - 依頼取得APIの呼び出し
  - スタイリング
  - _Requirements: 2_

- [x] 7.4 (P) OrderCardコンポーネントの実装
  - 依頼情報の表示（ステータス、予約種別、出発地・目的地、所要時間、車情報）
  - ドラッグ可能な実装（@dnd-kit）
  - 住所の短縮表示
  - アイコンの表示（メモ有無等）
  - スタイリング
  - _Requirements: 2, 3_

- [x] 7.5 TimelineGridコンポーネントの実装
  - 18:00〜翌06:00の表示範囲
  - 15分刻みの時間軸表示
  - 車両レーンの表示
  - ドロップゾーンの実装（@dnd-kit）
  - 15分刻みスナップ処理
  - 06:00超過チェックと拒否処理
  - 時間→px変換（15分 = 20px）
  - スタイリング（CSS Grid + absolute配置）
  - _Requirements: 3, 4, 8_

- [x] 7.6 (P) SlotComponentコンポーネントの実装
  - スロット情報の表示（開始時刻・終了時刻、出発地→目的地、ステータス）
  - ドラッグ可能な実装（@dnd-kit、確定前のみ）
  - 確定済みslotの移動時の自動確定解除
  - 競合時の赤枠＋⚠アイコン表示
  - バッファ手動設定時の「手」アイコン表示
  - スタイリング
  - _Requirements: 3, 4_

- [x] 7.7 (P) OrderDetailPanelコンポーネントの実装
  - スライドイン表示機能
  - 依頼詳細の表示（出発地、目的地、車情報、連絡先等）
  - ルート情報と所要時間の表示
  - バッファ時間の表示と手動調整（+/-ボタン）
  - 確定/解除/削除（キャンセル）ボタン
  - 住所・メモの編集機能
  - ルート再計算ボタン
  - 依頼更新APIの呼び出し
  - エラーハンドリング
  - スタイリング
  - _Requirements: 5, 7, 9_

- [x] 8. ドラッグ&ドロップ機能の統合
- [x] 8.1 カードからタイムラインへのドロップ処理
  - OrderCardからTimelineGridへのドロップ処理
  - ドロップ位置の時刻取得と15分刻みスナップ
  - スロット作成APIの呼び出し
  - タイムラインへの表示更新
  - エラーハンドリング
  - _Requirements: 3_

- [x] 8.2 スロットの移動処理
  - 同一レーン内での左右ドラッグ処理
  - 別レーンへの移動処理
  - スロット更新APIの呼び出し
  - 確定済みslotの移動時の確定解除処理
  - エラーハンドリング
  - _Requirements: 3_

- [ ] 9. 競合検出と警告機能の統合
- [ ] 9.1 クライアント側競合検出の統合
  - TimelineGridでの競合検出処理
  - 競合slotの視覚的表示（赤枠＋⚠アイコン）
  - 確定ボタンの無効化
  - リアルタイム更新
  - _Requirements: 6_

- [ ] 9.2 (P) 競合解決機能の実装
  - スロット移動による競合解決
  - 別車両への移動による競合解決
  - バッファ手動調整による競合解決
  - ユーザーフィードバック
  - _Requirements: 6_

- [ ] 10. 営業時間制約機能の実装
- [ ] 10.1 営業時間制約の実装
  - 18:00〜翌06:00の表示範囲制限
  - 06:00超過チェック処理
  - ドロップ拒否時のトーストメッセージ表示
  - ヘッダーへの営業日表示
  - 18:00以前・翌06:00以降の非表示
  - _Requirements: 8_

- [ ] 11. 統合とテスト
- [ ] 11.1 エンドツーエンド統合テスト
  - 依頼作成から配車確定までのフロー
  - ドラッグ&ドロップ操作のテスト
  - 競合検出と警告のテスト
  - 営業時間制約のテスト
  - エラーケースのテスト
  - _Requirements: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10_

- [ ] 11.2* ユニットテストの拡充
  - バッファ計算ロジックのテスト
  - 競合判定ロジックのテスト
  - 時間計算ユーティリティのテスト
  - コンポーネントのレンダリングテスト
  - _Requirements: 5, 6_

- [ ] 11.3* 統合テストの拡充
  - APIエンドポイントの統合テスト
  - データベース操作の統合テスト
  - Google Maps API連携の統合テスト
  - _Requirements: 1, 5, 10_

