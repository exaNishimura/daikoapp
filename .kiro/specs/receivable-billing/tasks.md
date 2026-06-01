# Implementation Plan

## Strategy

実装は **「DB → 純関数 → hook → ページ」の順** に積み上げる。各タスクが完了するたびに対応する Vitest を緑にする。Excel インポートは過去データ移行用なので **最後** に着手し、まず日々の運用 UI を完成させる。

実データ（`excel-imports/sales/202605稼働管理表new.xlsx`）の検証ターゲットは requirements.md の Validation Targets を参照。

> **Parallel marker**: ` (P)` 付きはディスク・テーブルが独立しており並行実装可。

---

## 1. データベース基盤

- [x] 1.1 マイグレーション作成
  - `supabase/migrations/20260602030000_add_receivable_billing_schema.sql` を作成（schema を seed と分離）
  - 8 テーブル: `company_profile` `companies` `invoices` `accounts_receivable` `daily_sales` `daily_staff_sales` `staff_rates` `monthly_fixed_expenses`
  - `daily_sales.total_sales` / `profit` は GENERATED ALWAYS AS ... STORED 列
  - `accounts_receivable` は UNIQUE NULLS NOT DISTINCT で NULL 許容列込みの重複防止
  - `billing_month` は CHECK で月初日のみ許容
  - `update_updated_at_column()` トリガーを全テーブルに適用
  - RLS 有効化、`authenticated` ロールに full access のポリシー（anon は一切不可）
  - MCP `apply_migration` で本番に適用済み
  - _Requirements: 8.3, 8.4, NFR-1, NFR-2_

- [x] 1.2 (P) 初期データ seed
  - `supabase/migrations/20260602030500_seed_receivable_billing.sql`
  - `company_profile` 1 行 / `staff_rates` 9 行 / `companies` 15 行
  - すべて `ON CONFLICT DO NOTHING`
  - MCP 適用後、SELECT count で 1 / 9 / 15 を確認
  - _Requirements: 1, 4.7, 7.4_

- [x] 1.3 Storage バケット作成手順を文書化
  - MCP に Storage 作成ツールが無いため、Supabase Dashboard 手動操作の手順を `supabase/README.md` に追記
  - バケット名 `invoices`、private、10 MB 制限、xlsx mime、authenticated-only policy
  - ファイルパス命名: `invoices/YYYY/MM/{company_id}-{display_name}.xlsx`
  - **このタスクの実バケット作成はオーナー手動（請求書発行画面の実装直前で OK）**
  - _Requirements: 3.9_

---

## 2. 純関数ライブラリ（Excel パース・生成）

- [x] 2.1 値パーサー
  - `src/lib/excel/value-parsers.js` に `parseAmount` `parseKm` `parseHours` `parseDay` `parseJpDate` を実装
  - `src/lib/excel/value-parsers.test.js` で `"¥41,000"` `"¥27,000-"` `"175km"` `"9.50h"` `"5日"` `"2026年5月31日"` の各パターンを assertion
  - _Requirements: 6.4, 6.7, 8.1_

- [x] 2.2 (P) フォーマッター
  - `src/lib/excel/formatters.js` に `formatYen` `formatYenWithDash` `formatJpDate` `formatDay` を実装
  - `formatYen(3000) === '¥3,000'` `formatYenWithDash(27000) === '¥27,000- '` `formatJpDate(new Date(2026,4,8)) === '2026年05月08日'` などのテスト
  - _Requirements: 3.7_

- [x] 2.3 集計シートパーサー
  - `src/lib/excel/parseDailySheet.js` を実装
  - 日次行（行 3..33）から `DailySaleRow[]` `StaffSaleRow[]` を生成
  - 末尾サマリ領域（行 38 以降）から `FixedExpenseRow[]` を抽出（重複ラベルは suffix 付与）
  - 列定数 `COL` を design.md に従って定義
  - _Requirements: 6.4, 6.5_

- [x] 2.4 売掛シートパーサー
  - `src/lib/excel/parseReceivablesSheet.js` を実装
  - 企業ブロック × 空行区切りのステートマシン処理
  - 「企業名だけ」の行（明細なし）はスキップしつつ、その企業を `seenCompanies` に登録
  - _Requirements: 6.4, 6.5_

- [x] 2.5 ワークブック統合パーサー
  - `src/lib/excel/parseSalesWorkbook.js` を実装
  - SheetJS で読み、シート名検証 → ファイル名から `period` 抽出 → 2 シートを並列パース → `ParseResult` を返す
  - エラー（行番号・シート名・列名付き）を `errors` 配列に集約
  - _Requirements: 6.2, 6.3, 6.7, 8.5_

- [x] 2.6 パーサー統合テスト（**実データ検証**）
  - `src/lib/excel/parseSalesWorkbook.test.js`
  - `excel-imports/sales/202605稼働管理表new.xlsx` を読み込んで Validation Targets と一致することを assertion：
    - 売掛全体合計 = 104,000
    - 総売上合計 = 826,500
    - 鈴友 8 件・27,000
    - 鈴友 5/18 の備考「P1000円　一ノ宮経由」
    - 5/1 燃料代 1 号車 = 3,000
    - 5/1 西村稼働時間 = 9.5
    - 取引先 15 社の登場（`seenCompanies`）
  - _Requirements: Validation Targets, 8.1_

- [x] 2.7 請求書生成器
  - `src/assets/invoice-template.xlsx` を `excel-imports/templates/202605鈴友.xlsx` を加工して同梱（明細を空にしたテンプレ版）
  - `src/lib/excel/generateInvoice.js` を実装、ExcelJS でテンプレを読み込みセル位置仕様に従って値を埋める
  - 18 件超のときは例外を投げる（呼び出し側で戦略決定）
  - _Requirements: 3.7_

- [x] 2.8 請求書生成テスト（**実データ検証**）
  - `src/lib/excel/generateInvoice.test.js`
  - 鈴友 5 月分 8 件のデータを与えて生成、出力 .xlsx を読み戻し：
    - `B5 === '株式会社 鈴友'`
    - `E10 === '¥27,000- '`
    - `B13 === '1 '`、`C13 === '2026年05月08日'`、`E13 === '算所'`、`F13 === '旭が丘'`、`G13 === '¥3,000'`
    - `H18 === 'P1000円　一ノ宮経由'`
  - _Requirements: Validation Targets_

- [x] 2.9 (P) 取引先マッチャー
  - `src/lib/billing/matchCompany.js` を実装
  - 入力 `(rawName, companies[])` → `(companyId | null, candidates[])`
  - 完全一致 → エイリアス一致 → 正規化（半角/全角・株式会社接頭辞除去）一致 の順で候補を返す
  - `src/lib/billing/matchCompany.test.js` で「鈴友」「株式会社 鈴友」「(株)鈴友」「鈴友 」（末尾空白）が同じ company にヒットすることを確認
  - _Requirements: 1.6, 6.5_

---

## 3. データアクセス Hook 層

- [ ] 3.1 queryKeys 拡張
  - `src/lib/queryClient.js` に `companies` `receivables` `invoices` `dailySales` `staffSales` `staffRates` `fixedExpenses` `companyProfile` のキー定義を追加
  - _Requirements: 既存方針_

- [ ] 3.2 (P) `useCompanies`
  - `src/hooks/billing/useCompanies.js`
  - `useCompanies()` `useCreateCompany()` `useUpdateCompany()` `useDeactivateCompany()` `useReorderCompanies()`
  - 各 mutation で関連クエリを invalidate
  - _Requirements: 1_

- [ ] 3.3 (P) `useCompanyProfile`
  - `src/hooks/billing/useCompanyProfile.js`
  - `useCompanyProfile()` `useUpdateCompanyProfile()`
  - _Requirements: 7_

- [ ] 3.4 (P) `useReceivables`
  - `src/hooks/billing/useReceivables.js`
  - `useReceivables(filter)` `useCreateReceivable()` `useUpdateReceivable()` `useDeleteReceivable()`
  - filter は `{ month, companyId, invoiced, paid }`
  - _Requirements: 2_

- [ ] 3.5 (P) `useDailySales` `useStaffSales` `useStaffRates`
  - `src/hooks/billing/useDailySales.js` `useStaffSales.js` `useStaffRates.js`
  - upsert / fetch by yearMonth
  - _Requirements: 4_

- [ ] 3.6 (P) `useFixedExpenses`
  - `src/hooks/billing/useFixedExpenses.js`
  - 月別 fetch、label 別 upsert
  - _Requirements: 4.7_

- [ ] 3.7 `useInvoices` + 発行ロジック
  - `src/hooks/billing/useInvoices.js`
  - `useInvoices(filter)` `useUnpaidInvoices()` `useMarkInvoicePaid()`
  - `useIssueInvoices(monthlyParams)` は重い：
    - 未請求売掛を企業別に集約
    - 各企業について `generateInvoice` を呼び .xlsx 生成
    - Storage にアップロード
    - `invoices` insert + `accounts_receivable.invoice_id` 一括更新（Postgres 関数で 1 トランザクション）
  - `useRevokeInvoice()` は逆操作
  - _Requirements: 3, 5_

- [ ] 3.8 RPC: 請求書発行をサーバー側で原子化
  - `supabase/migrations/20260602030500_add_invoice_rpc.sql` に
    `issue_invoice(company_id, billing_month, total_amount, line_count, profile_snapshot)` RPC を追加
    （内部で `invoices` insert → 当該 `accounts_receivable.invoice_id` 更新）
  - クライアントは `supabase.rpc('issue_invoice', ...)` を呼ぶ
  - 同月二重発行は unique 制約で防ぐ
  - _Requirements: 3.5, 3.6, NFR-1_

---

## 4. 共通コンポーネント

- [ ] 4.1 (P) `CompanySelect`
  - `src/components/Receivables/CompanySelect.jsx`
  - MUI `Autocomplete`、`name + aliases` を全文検索、`is_active=false` は灰色表示
  - props: `value, onChange, includeInactive`
  - _Requirements: 1, 2_

- [ ] 4.2 (P) `AmountInput` `MonthPicker` `StatusBadge`
  - `src/components/Receivables/AmountInput.jsx`：`"¥X,XXX"` 入力許容、内部は number
  - `src/components/Receivables/MonthPicker.jsx`：MUI DatePicker views=`['year','month']`
  - `src/components/Receivables/StatusBadge.jsx`：請求済/未請求/入金済 の Chip
  - _Requirements: 2, 3, 4, 5_

---

## 5. 取引先マスタ画面

- [ ] 5.1 `CompaniesPage` レイアウト
  - `src/pages/Receivables/CompaniesPage.jsx`
  - 一覧テーブル、新規追加ボタン、編集ダイアログ、ドラッグ並び替え（`@dnd-kit/sortable` 既存利用）
  - is_active=false 行は半透明 + 「無効」バッジ
  - _Requirements: 1.1, 1.4, 1.7_

- [ ] 5.2 取引先編集フォーム
  - `src/pages/Receivables/CompanyEditDialog.jsx`
  - フィールド：name, invoice_display_name, aliases（chip 入力）, display_order, is_active, memo
  - 重複名バリデーション
  - _Requirements: 1.2, 1.3, 1.6_

- [ ] 5.3 ルーティング登録
  - `App.jsx`（または既存ルーター定義）に `/admin/companies` を追加
  - ナビメニューに「売掛・請求書 > 取引先マスタ」エントリ
  - _Requirements: 既存統合_

---

## 6. 自社情報画面

- [ ] 6.1 `CompanyProfilePage`
  - `src/pages/Receivables/CompanyProfilePage.jsx`
  - 単一フォーム、`useCompanyProfile` で取得・保存
  - フィールド：name, postal_code, address, invoice_number, bank, bank_branch, bank_account_type, bank_account_number, bank_account_holder
  - _Requirements: 7_

- [ ] 6.2 ルーティング・メニュー登録
  - `/admin/company-profile`
  - _Requirements: 既存統合_

---

## 7. 売掛一覧画面（日々の入口）

- [ ] 7.1 `ReceivablesListPage` 雛形
  - `src/pages/Receivables/ReceivablesListPage.jsx`
  - フィルタ UI（月・企業・請求済/入金済）+ サマリ + テーブル
  - `useReceivables(filter)` でデータ取得
  - _Requirements: 2.1, 2.8, 2.9_

- [ ] 7.2 `ReceivablesTable` + 行コンポーネント
  - 行は表示・編集モードを切替
  - 編集中の行は `CompanySelect` `AmountInput` 等を使用
  - `invoice_id` ありの行は編集ロック + ロックアイコン表示
  - _Requirements: 2.5, 2.6_

- [ ] 7.3 `ReceivablesAddRow`
  - 新規追加用インライン行、保存ボタンで `useCreateReceivable`
  - work_date は当月内バリデーション
  - _Requirements: 2.2, 2.3, 2.4_

- [ ] 7.4 削除フロー
  - 確認ダイアログ → `useDeleteReceivable`
  - 請求書発行済みは削除不可
  - _Requirements: 2.7_

- [ ] 7.5 (P) CSV エクスポート
  - 現フィルタ結果を UTF-8 BOM 付き CSV でダウンロード
  - `src/lib/billing/exportReceivablesCsv.js` 純関数 + テスト
  - _Requirements: 2.10_

- [ ] 7.6 ルーティング・メニュー登録
  - `/admin/receivables` をデフォルト売掛系トップに
  - _Requirements: 既存統合_

---

## 8. 日次売上ダッシュボード

- [ ] 8.1 `DailySalesPage` 雛形
  - `src/pages/Receivables/DailySalesPage.jsx`
  - 月選択、日次テーブル、スタッフ別タブ、月額固定経費パネル、月次サマリ
  - _Requirements: 4.1, 4.2_

- [ ] 8.2 `DailySalesTable`（インライン編集）
  - 列：日 / 曜日 / 距離(1)/(2) / 燃料代(1)/(2) / 売上(1)/(2)/(3) / 経費内容 / 経費金額 / 現金 / 収益
  - upsert は debounce 500ms
  - 1 ヶ月分一括レンダリングは仮想化不要（最大 31 行）
  - _Requirements: 4.3, 4.4_

- [ ] 8.3 `StaffSalesTable`
  - 縦：スタッフ、横：1〜31 日、各セル = `(sales / hours)`
  - _Requirements: 4.5_

- [ ] 8.4 `MonthlyFixedExpensesPanel`
  - label と amount のリスト、追加・編集・削除
  - `useFixedExpenses(yearMonth)`
  - _Requirements: 4.7_

- [ ] 8.5 `MonthlySummary` + 人件費計算
  - `src/lib/billing/calcStaffPayroll.js` 純関数：`(staffSales, staffRates) → { staff, payroll }[]`
  - 月次集計をメモ化して表示
  - _Requirements: 4.6, 4.8_

- [ ] 8.6 ルーティング・メニュー登録
  - `/admin/sales`
  - _Requirements: 既存統合_

---

## 9. 請求書発行画面

- [ ] 9.1 `InvoicesPage` 雛形
  - `src/pages/Receivables/InvoicesPage.jsx`
  - タブ：発行済一覧 / 未入金一覧 / 新規発行
  - _Requirements: 3.1, 5.4_

- [ ] 9.2 `InvoiceIssueModal`
  - 月選択 → 未請求売掛を企業別に集約してプレビュー表示
  - 行ごとに対象 on/off、件数 19+ 警告、戦略選択（スキップ/合算/分割）
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 9.3 発行実行
  - 選択された企業ごとに `generateInvoice` を呼び .xlsx 生成
  - Storage にアップロード（成功時 file_path 保存、失敗時 file_path=null で警告だけ表示）
  - `issue_invoice` RPC で DB 更新
  - 完了後 zip で一括 DL リンク + 個別 DL リンク
  - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9_

- [ ] 9.4 発行済一覧 + 再ダウンロード
  - 行に「ダウンロード」「取消」「入金済チェック」
  - ダウンロードは Storage 署名 URL を都度発行
  - _Requirements: 3.10, 3.11, 5.1, 5.2, 5.3_

- [ ] 9.5 未入金一覧
  - `paid_at IS NULL` の請求書を `billing_month` 昇順で
  - 企業別未収金合計、滞留日数、60 日超アラート
  - _Requirements: 5.4, 5.5, 5.6_

- [ ] 9.6 ルーティング・メニュー登録
  - `/admin/invoices`
  - _Requirements: 既存統合_

---

## 10. Excel インポート画面（最後・補助機能）

- [ ] 10.1 `ReceivablesImportPage` 雛形
  - `src/pages/Receivables/ReceivablesImportPage.jsx`
  - 警告バナー「初期データ移行用です。日々の運用は売掛画面から直接入力してください」
  - ドロップゾーン
  - _Requirements: 6.1, 6.2_

- [ ] 10.2 ファイル受け取り → パース → プレビュー
  - `parseSalesWorkbook` 呼び出し
  - 2 タブ表示（集計プレビュー / 売掛プレビュー）
  - エラー一覧パネル
  - _Requirements: 6.3, 6.4, 6.7_

- [ ] 10.3 `UnknownCompanyResolver`
  - 未マッチ企業ごとに `新規追加 / 既存統合 / スキップ` を選択させるモーダル
  - `matchCompany` の候補を提示
  - _Requirements: 6.5_

- [ ] 10.4 `DuplicateResolver`
  - 既存と一致する売掛を「重複（スキップ）」マーキング
  - 同月 Excel 再アップロード時の `スキップ/上書き/マージ` 選択
  - _Requirements: 6.6, 6.10, 6.11_

- [ ] 10.5 一括 import RPC
  - `supabase/migrations/20260602031000_add_import_rpc.sql` に
    `bulk_import_receivables(period, daily_sales, staff_sales, receivables, fixed_expenses, source_file)` RPC
  - 内部でトランザクション・upsert・既存削除（上書き時）
  - 発行済みデータがある場合はエラーを返す
  - _Requirements: 6.8, 6.9, 6.11_

- [ ] 10.6 import 実行 + 結果サマリ
  - クライアントから RPC 呼び出し
  - 成功件数 / スキップ件数 / エラー件数を表示
  - _Requirements: 6.8, 6.9_

- [ ] 10.7 ルーティング・メニュー登録
  - `/admin/receivables/import`、ナビでは目立たない位置（売掛画面の右上から遷移できるように）
  - _Requirements: 既存統合_

---

## 11. 仕上げ

- [ ] 11.1 (P) E2E スモークテスト
  - 「取引先追加 → 売掛入力 → 請求書発行 → 入金済」の経路を RTL でテスト
  - _Requirements: NFR-4_

- [ ] 11.2 (P) 5 月分実データのインポート→請求書発行→鈴友請求書が手動版と一致 を結合テストで確認
  - 該当テストは CI で動かないように `*.integration.test.js` 命名にして手動実行
  - _Requirements: Validation Targets_

- [ ] 11.3 (P) ドキュメント
  - `docs/receivable-billing.md`：オーナー向けの運用マニュアル（日々の流れ、月次の流れ、復旧時の Excel インポート手順）
  - _Requirements: 既存方針_

- [ ] 11.4 PR・main マージ
  - lint / format / test / build がすべて green
  - レビューチェックリストで Validation Targets を確認
  - feat/receivable-billing → main に fast-forward マージ

---

## Out of Scope（このスプリントでやらない）

- 請求書 PDF 出力
- 取引先へのメール送信
- 会計ソフト連携
- スマホ最適化
- 複数管理者ロール
- スタッフ単価の変更履歴
