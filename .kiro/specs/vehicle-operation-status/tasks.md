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

- [ ] 1. データベーススキーマの実装
- [ ] 1.1 vehicle_operation_statusテーブルの作成
  - Supabase SQL Editorでvehicle_operation_statusテーブルを作成
  - カラム定義: id, vehicle_id, type, date, time, created_at, updated_at
  - CHECK制約: typeの値チェック、timeの必須チェック（STOP/STARTの場合）
  - UNIQUE制約: vehicle_id, date, typeの組み合わせ
  - 外部キー制約: vehicle_id → vehicles.id (ON DELETE CASCADE)
  - インデックス: vehicle_id + date, date
  - updated_at自動更新トリガーの設定
  - _Requirements: 5.1, 5.2_

- [ ] 2. Service層の実装
- [ ] 2.1 vehicleOperationService.jsの実装
  - getVehicleOperationStatus(vehicleId, date): 指定車両・指定日の稼働状況を取得
  - setVehicleOperationStatus(vehicleId, statusData): 稼働状況を設定（INSERT/UPDATE）
  - deleteVehicleOperationStatus(vehicleId, statusId): 稼働状況設定を削除
  - エラーハンドリングとリトライロジック
  - Supabaseクライアントを使用したデータ永続化
  - _Requirements: 1.2, 5.1, 5.2, 5.3_

- [ ] 3. Utils層の実装
- [ ] 3.1 operationStatusUtils.jsの実装
  - isVehicleOperational(vehicleId, targetTime, operationStatuses): 指定時刻で車両が稼働中か判定
  - getOperationalVehicles(vehicles, targetTime, operationStatusesMap): 指定時刻で稼働中の車両リストを取得
  - mergeOperationStatuses(statuses): 複数の稼働状況設定をマージし、優先順位を適用
  - 優先順位ロジック: START > STOP > DAY_OFF > DEFAULT
  - 時間範囲チェックロジック（営業時間18:00〜翌06:00を考慮）
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 4.1, 4.2, 4.3, 4.4_

- [ ] 4. UI層の実装
- [ ] 4.1 VehicleOperationStatusModalコンポーネントの実装
  - Material-UI Dialogを使用したモーダルUI
  - 稼働状況設定フォーム（4つのパターン選択）
  - 日時入力フィールド（date, time）
  - 既存設定の一覧表示と削除機能
  - バリデーション（日時形式、必須項目チェック）
  - 保存・キャンセルボタン
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.4_

- [ ] 4.2 DispatchBoardへの設定ボタン追加
  - ヘッダーに設定ボタンを追加（各車両のヘッダーまたはグローバル設定）
  - 設定ボタンクリックでVehicleOperationStatusModalを表示
  - 選択中の車両IDをモーダルに渡す
  - _Requirements: 1.1_

- [ ] 5. 既存コンポーネントへの統合
- [ ] 5.1 vehicleService.jsの拡張
  - getVehicles()に稼働状況チェックを統合
  - 指定時刻で稼働中の車両のみを取得するオプション追加
  - operationStatusUtilsを使用した稼働状況判定
  - _Requirements: 2.5_

- [ ] 5.2 TimelineGrid.jsxの拡張
  - 非稼働時間帯の視覚的表示（グレーアウト、斜線パターン）
  - ドラッグ&ドロップ時の稼働状況チェック
  - 非稼働時間帯へのドロップを拒否し、エラーメッセージを表示
  - 車両ヘッダーに稼働状況インジケーターを表示
  - operationStatusUtilsを使用した稼働状況判定
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

- [ ] 5.3 slotUtils.jsの拡張
  - findEarliestAvailableSlot()に稼働状況チェックを統合
  - 稼働中の車両のみを対象として空き時間を検索
  - findEarliestAvailableSlotAcrossVehicles()に稼働状況チェックを統合
  - operationStatusUtilsを使用した稼働状況判定
  - _Requirements: 2.3_

- [ ] 5.4 earliestTimeUtils.jsの拡張
  - getEarliestAvailableTimeWithSlots()に稼働状況チェックを統合
  - 稼働中の車両のスロットのみを考慮して受付可能時間を計算
  - operationStatusUtilsを使用した稼働状況判定
  - _Requirements: 2.4_

- [ ] 5.5 DispatchBoard.jsxの拡張
  - ドラッグ&ドロップ時の稼働状況チェック
  - 自動配置機能に稼働状況チェックを統合
  - 稼働状況データの取得とキャッシュ
  - 稼働状況更新時のリアルタイム反映（Supabase Realtimeまたは手動リロード）
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 6. スタイリングとUI改善
- [ ] 6.1 非稼働時間帯の視覚的スタイル実装
  - TimelineGrid.cssに非稼働時間帯のスタイルを追加
  - グレーアウト、斜線パターン、透明度の調整
  - 車両ヘッダーの稼働状況インジケータースタイル
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. エラーハンドリングとバリデーション
- [ ] 7.1 エラーハンドリングの実装
  - 稼働状況設定時のエラーメッセージ表示
  - ドロップ拒否時のエラーメッセージ表示
  - データベースエラー時の適切な処理
  - _Requirements: 2.2_

- [ ] 8. テストと検証
- [ ] 8.1* ユニットテストの実装
  - operationStatusUtilsの判定ロジックテスト
  - 各種稼働状況パターンでの判定テスト
  - 優先順位ロジックのテスト
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 4.1, 4.2, 4.3_

- [ ] 8.2* 統合テストの実装
  - 稼働状況設定 → タイムライン表示への反映テスト
  - 稼働状況設定 → スロット検索への反映テスト
  - 稼働状況設定 → 自動配置への反映テスト
  - 稼働状況設定 → 受付可能時間計算への反映テスト
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [ ] 8.3* E2Eテストの実装
  - 設定ボタンクリック → モーダル表示 → 稼働状況設定 → 保存 → タイムライン反映
  - 非稼働時間帯へのドラッグ&ドロップ → エラーメッセージ表示
  - 複数の稼働状況設定の組み合わせ → 正しい優先順位での判定
  - _Requirements: 1.1, 1.2, 2.2, 4.1, 4.2, 4.3_

---

