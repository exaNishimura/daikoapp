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

- [x] 3.1 queryKeys 拡張
  - `src/lib/queryClient.js` に `companies` `receivables` `invoices` `dailySales` `staffSales` `staffRates` `fixedExpenses` `companyProfile` のキー定義を追加
  - _Requirements: 既存方針_

- [x] 3.2 (P) `useCompanies`
  - `src/hooks/billing/useCompanies.js`
  - `useCompanies()` `useCreateCompany()` `useUpdateCompany()` `useDeactivateCompany()` `useReorderCompanies()`
  - 各 mutation で関連クエリを invalidate
  - _Requirements: 1_

- [x] 3.3 (P) `useCompanyProfile`
  - `src/hooks/billing/useCompanyProfile.js`
  - `useCompanyProfile()` `useUpdateCompanyProfile()`
  - _Requirements: 7_

- [x] 3.4 (P) `useReceivables`
  - `src/hooks/billing/useReceivables.js`
  - `useReceivables(filter)` `useCreateReceivable()` `useUpdateReceivable()` `useDeleteReceivable()`
  - filter は `{ month, companyId, invoiced, paid }`
  - _Requirements: 2_

- [x] 3.5 (P) `useDailySales` `useStaffSales` `useStaffRates`
  - `src/hooks/billing/useDailySales.js` `useStaffSales.js` `useStaffRates.js`
  - upsert / fetch by yearMonth
  - _Requirements: 4_

- [x] 3.6 (P) `useFixedExpenses`
  - `src/hooks/billing/useFixedExpenses.js`
  - 月別 fetch、label 別 upsert
  - _Requirements: 4.7_

- [x] 3.7 `useInvoices` + 発行ロジック
  - `src/hooks/billing/useInvoices.js`
  - `useInvoices(filter)` `useUnpaidInvoices()` `useMarkInvoicePaid()`
  - `useIssueInvoices(monthlyParams)` は重い：
    - 未請求売掛を企業別に集約
    - 各企業について `generateInvoice` を呼び .xlsx 生成
    - Storage にアップロード
    - `invoices` insert + `accounts_receivable.invoice_id` 一括更新（Postgres 関数で 1 トランザクション）
  - `useRevokeInvoice()` は逆操作
  - _Requirements: 3, 5_

- [x] 3.8 RPC: 請求書発行をサーバー側で原子化
  - `supabase/migrations/20260602030500_add_invoice_rpc.sql` に
    `issue_invoice` `revoke_invoice` `mark_invoice_paid` の 3 RPC を追加
    （`issue_invoice` は当月未請求の検算 → `invoices` insert → `accounts_receivable.invoice_id` 一括更新を 1 トランザクション）
  - クライアントは `supabase.rpc('issue_invoice', ...)` を `invoicesService.issueInvoice` 経由で呼ぶ
  - 同月二重発行は `invoices.UNIQUE(company_id, billing_month)` で防ぐ
  - GRANT EXECUTE は authenticated のみ、anon と PUBLIC は REVOKE
  - _Requirements: 3.5, 3.6, NFR-1_

---

## 4. 共通コンポーネント

- [x] 4.1 (P) `CompanySelect`
  - `src/components/Receivables/CompanySelect.jsx`
  - MUI `Autocomplete`、`name + aliases` を全文検索、`is_active=false` は灰色表示
  - props: `value, onChange, includeInactive`
  - _Requirements: 1, 2_

- [x] 4.2 (P) `AmountInput` `MonthPicker` `StatusBadge`
  - `src/components/Receivables/AmountInput.jsx`：`"¥X,XXX"` 入力許容、内部は number
  - `src/components/Receivables/MonthPicker.jsx`：MUI X `DatePicker` (`views=['year','month']`, `openTo='month'`, `format='YYYY年MM月'`)。I/O は 'YYYY-MM' 文字列。`@mui/x-date-pickers` + `dayjs` を導入し、`main.jsx` に `LocalizationProvider`（AdapterDayjs / locale=ja）を追加
  - `src/components/Receivables/StatusBadge.jsx`：請求済/未請求/入金済 の Chip
  - ヘルパは `monthUtils.js` (`toMonthString` / `fromMonthString` / `monthRange` / `dayjsToMonthString`) と `statusUtils.js` に分離（fast refresh 互換）
  - _Requirements: 2, 3, 4, 5_

---

## 5. 取引先マスタ画面

- [x] 5.1 `CompaniesPage` レイアウト
  - `src/pages/Receivables/CompaniesPage.jsx`
  - 一覧テーブル、新規追加ボタン、編集ダイアログ、ドラッグ並び替え（`@dnd-kit/sortable` 新規導入）
  - is_active=false 行は半透明 + 「無効」バッジ、無効化/有効化ボタン切り替え
  - 並び替えは `arrayMove` → `display_order = (i+1)*10` で再採番し `useReorderCompanies` で永続化
  - _Requirements: 1.1, 1.4, 1.5, 1.7_

- [x] 5.2 取引先編集フォーム
  - `src/pages/Receivables/CompanyEditDialog.jsx`
  - フィールド：name, invoice_display_name, aliases（MUI Autocomplete `multiple + freeSolo`）, display_order, is_active, memo
  - バリデーションは `src/lib/billing/companyForm.js` の純関数 `validateCompanyForm` に切り出し（17 テスト）。重複名検出 / 編集中自身を除外 / display_order 整数チェック
  - aliases は `normalizeAlias` / `normalizeAliases` で全角→半角・trim・重複除去を保存時に適用（req 1.6）
  - Dialog 本体は `open=true` 時のみマウントして `useState` 初期値でフォーム初期化（effect 内 setState を回避）
  - _Requirements: 1.2, 1.3, 1.6_

- [x] 5.3 ルーティング登録
  - `App.jsx` の `Routes` に `/admin/companies` を追加（`ProtectedRoute` でラップ）
  - 認証済みナビバーに「取引先マスタ」リンクを追加
  - _Requirements: 既存統合_

---

## 6. 自社情報画面

- [x] 6.1 `CompanyProfilePage`
  - `src/pages/Receivables/CompanyProfilePage.jsx`
  - 単一フォーム、`useCompanyProfile` で取得 / `useUpdateCompanyProfile` で保存
  - フィールド：name, postal_code, address, invoice_number, bank, bank_branch, bank_account_type (Select: 普通/当座/貯蓄), bank_account_number, bank_account_holder
  - バリデーションは `src/lib/billing/companyProfileForm.js` に純関数化（19 テスト）。郵便番号は全角→半角・ハイフン自動挿入、口座番号は数字のみ
  - 「元に戻す」「保存」ボタン、未変更時は disabled。ロード完了後にフォーム本体を `key={updated_at}` でマウントし `useState` 初期値で初期化（effect での setState 回避）
  - _Requirements: 7_

- [x] 6.2 ルーティング・メニュー登録
  - `App.jsx` に `/admin/company-profile` を `ProtectedRoute` 配下で追加
  - 認証済みナビバーに「自社情報」リンク
  - _Requirements: 既存統合_

---

## 7. 売掛一覧画面（日々の入口）

- [x] 7.1 `ReceivablesListPage` 雛形
  - `src/pages/Receivables/ReceivablesListPage.jsx`
  - フィルタ UI（MonthPicker / CompanySelect / 請求状態 / 入金状態）+ サマリ（件数・合計・企業別上位）+ テーブル
  - `useReceivables({ year, month, companyId, invoiced })` でサーバ側フィルタ。入金状態はクライアント側で post-filter
  - サマリは `src/lib/billing/receivablesSummary.js` の純関数 `summarizeReceivables` を使用（7 テスト）
  - 並び順は `work_date` 降順（同日は id 降順）— 要件 2.1「新しい順」
  - _Requirements: 2.1, 2.8, 2.9_

- [x] 7.2 `ReceivablesTable` + 行コンポーネント
  - `src/pages/Receivables/ReceivablesTable.jsx` 内に `DisplayRow` / `EditableRow` を内包し `editingId` で切替
  - 編集中の行は `CompanySelect` `AmountInput` `<input type="date">` 等を使用、`work_date` の min/max は当月の月初/末日
  - `invoice_id` ありの行は編集ボタン・削除ボタンが disabled + 行頭に `LockIcon` を表示
  - 非アクティブ取引先の行は `opacity: 0.6` で半透明
  - _Requirements: 2.5, 2.6_

- [x] 7.3 `ReceivablesAddRow`
  - `src/pages/Receivables/ReceivablesAddRow.jsx`：「売掛を追加」ボタン → 展開、`useCreateReceivable` を呼ぶ
  - work_date のデフォルトは「対象月が当月なら今日、それ以外なら 1日」
  - 保存後は「保存して続けて入力」で連続入力可（company_id は保持）
  - バリデーションは純関数 `validateReceivableForm` で当月内チェック・金額整数チェック（14 テスト）
  - billing_month は `toBillingMonthFromWorkDate(work_date)` で自動算出
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 7.4 削除フロー
  - 確認ダイアログ（`confirm()`）→ `useDeleteReceivable.mutateAsync(row.id)`
  - `row.invoice_id != null` のときは削除ボタン自体が disabled、かつクリックされても先頭で弾く
  - _Requirements: 2.7_

- [x] 7.5 (P) CSV エクスポート
  - `src/lib/billing/exportReceivablesCsv.js`：純関数 `buildReceivablesCsv(rows)` + `escapeCsvField` (14 テスト)
    - UTF-8 BOM 付き、CRLF 区切り、RFC 4180 風クォート
    - ヘッダ: `id, 請求月, 日付, 取引先, 出発, 到着, 金額, 備考, 請求状態, 入金状態`
  - ページ側の `downloadTextFile` ヘルパで Blob → `a.click()` で DL、ファイル名 `receivables-YYYYMM.csv`
  - _Requirements: 2.10_

- [x] 7.6 ルーティング・メニュー登録
  - `App.jsx` に `/admin/receivables` を `ProtectedRoute` 配下で追加
  - 認証済みナビバーに「売掛」リンクを最上位に追加
  - _Requirements: 既存統合_

---

## 8. 日次売上ダッシュボード

- [x] 8.1 `DailySalesPage` 雛形
  - `src/pages/Receivables/DailySalesPage.jsx`：`MonthPicker` + Tabs（日次/スタッフ別/固定経費）+ `MonthlySummary` を常時表示
  - `useDailySales` `useStaffSales` `useStaffRates` `useFixedExpenses` `useReceivables` を統合
  - `daily_sales.receivable_total` が null のとき `accounts_receivable` から集計補完
  - _Requirements: 4.1, 4.2_

- [x] 8.2 `DailySalesTable`（インライン編集）
  - 列：日/曜/距離(1)/(2)/燃料(1)/(2)/売上(1)/(2)/(3)/経費内容/経費金額/現金/[派生] 総売上/燃料計/推定収益
  - `src/hooks/useDebouncedCallback.js` で 500ms debounce upsert
  - 1 ヶ月分（最大 31 行）を `daysInMonth` で動的生成、土日は色付け
  - `calcDailyDerived` 純関数で派生表示（GENERATED 列 `total_sales`/`profit` が DB 反映前でも即時表示）
  - _Requirements: 4.3, 4.4_

- [x] 8.3 `StaffSalesTable`
  - 縦：スタッフ（rates の `display_order` 順）、横：1〜末日、各セル `sales / hours` を 2 行表示
  - セルクリックで「その日の全スタッフ分」を一括編集するダイアログ（`upsertStaffSalesBulk`）
  - 月合計列を表示
  - _Requirements: 4.5_

- [x] 8.4 `MonthlyFixedExpensesPanel`
  - label と amount のリスト、`AmountInput` の blur で `useUpsertFixedExpense`、削除アイコンで `useDeleteFixedExpense`
  - 「共済掛金/損害保険/駐車場/携帯/税理士」のクイック追加ボタン（既登録は非表示）
  - カスタム項目追加フォーム
  - _Requirements: 4.7_

- [x] 8.5 `MonthlySummary` + 人件費計算
  - `src/lib/billing/calcStaffPayroll.js` 純関数：時間制 = `hours × hourly_rate`、歩合制 = `sales × commission_rate`、unknown は 0（9 テスト）
  - `src/lib/billing/dailySalesCalc.js`：`calcDailyDerived` + `calcMonthlySalesSummary`（11 テスト）
  - サマリ: 総売上/売掛/現金/経費/燃料/人件費/固定経費/推定粗利 + スタッフ別人件費カード
  - _Requirements: 4.6, 4.8_

- [x] 8.6 ルーティング・メニュー登録
  - `App.jsx` に `/admin/sales` を `ProtectedRoute` 配下で追加
  - ナビバーに「日次売上」リンク追加（売掛より前）
  - _Requirements: 既存統合_

---

## 9. 請求書発行画面

- [x] 9.1 `InvoicesPage` 雛形
  - `src/pages/Receivables/InvoicesPage.jsx`：MUI Tabs（新規発行 / 発行済一覧 / 未入金一覧）+ 共通 `MonthPicker`
  - 未入金タブは月非依存（全期間）なのでタブ切替時に月選択を非表示
  - _Requirements: 3.1, 5.4_

- [x] 9.2 `InvoiceIssueTab`（モーダル相当の発行UI）
  - `useUnbilledByCompany(year, month)` で月内未請求を企業別集約 → MUI Table 表示
  - 行ごとにチェックボックス（デフォルト on）、件数 ≥ 19 で `WarningAmberIcon` バナー + 行ハイライト
  - 戦略選択: 通常 / 合算 / 分割 / スキップ（19+ 行のみ Radio 表示）
  - `recommendedStrategy(line_count)` で初期値推奨（19+ なら `merge`）
  - 「{N} 社を発行」ボタン → `useIssueInvoices.mutate({ year, month, targets: [{ companyId, strategy }] })`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 9.3 発行実行
  - 純関数 `src/lib/billing/invoiceLineStrategies.js`: `INVOICE_MAX_LINES`/`STRATEGIES`/`applyMergeStrategy`/`applySplitStrategy`/`recommendedStrategy`（13 テスト）
  - `useIssueInvoices` を targets 配列 `[{ companyId, strategy }]` 対応へ拡張
    - merge: 先頭 17 + 「その他」1 行に集約して 1 枚発行
    - split: 18 行ずつ複数枚生成。Storage に `{path}-1of3.xlsx` 形式で保存。DB の `(company_id, billing_month) UNIQUE` 制約があるため `issue_invoice` RPC は 1 枚目だけ呼び出し（残り枚は file_path のみ提供）
    - skip: 発行対象から除外
  - Storage アップロードは `uploadInvoiceFile`（失敗時は Error → `failures` に積む）
  - 並列度 3 で `Promise.allSettled`、部分成功許容
  - `useDownloadInvoice` 追加（`getInvoiceFileUrl` 署名 URL → `window.open`）
  - `src/lib/billing/downloadInvoicesZip.js`：jszip で全成功分を zip 化 → Blob → `a.click()` で DL
  - 結果は `InvoiceIssueResultDialog` で個別 DL リンク + 「全件 zip で DL」+ failure 一覧表示
  - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 9.4 発行済一覧 + 再ダウンロード
  - `InvoiceIssuedTab`: 当月の `useInvoices({ year, month })` → 取引先/発行日/件数/金額/入金チェック/操作（DL/取消）の表
  - 入金チェック on/off で `useMarkInvoicePaid.mutate({ id, paidAt })`（off は `paidAt: null`）
  - 取消は `window.confirm` 後 `useRevokeInvoice`、入金済みは取消ボタン無効
  - DL は `useDownloadInvoice`（署名 URL 5 分有効）
  - _Requirements: 3.10, 3.11, 5.1, 5.2, 5.3_

- [x] 9.5 未入金一覧
  - 純関数 `src/lib/billing/invoiceAging.js`: `daysOverdue`/`isOverdue60`/`summarizeUnpaidInvoices`（14 テスト）
  - `InvoiceUnpaidTab`: `useUnpaidInvoices()`（`paid_at IS NULL` 全期間）→ `billing_month` 昇順
  - サマリエリア: 総未収金/件数/平均滞留日数/60 日超アラートカウント
  - 企業別未収金カード（最長滞留日数 60 超で赤枠）
  - 行で滞留日数 60 超は `error.50` 背景 + 赤 Chip、入金チェックボックス（→ markPaid）
  - _Requirements: 5.4, 5.5, 5.6_

- [x] 9.6 ルーティング・メニュー登録
  - `App.jsx` に `/admin/invoices` を `ProtectedRoute` 配下で追加
  - ナビバーに「請求書」リンク追加（売掛の右隣）
  - _Requirements: 既存統合_

---

## 10. Excel インポート画面（最後・補助機能）

- [x] 10.1 `ReceivablesImportPage` 雛形
  - `src/pages/Receivables/ReceivablesImportPage.jsx`：警告バナー（初期データ移行・運用復旧用）+ 戻るボタン
  - `ImportDropZone`：`.xlsx` 拡張子チェック、クリック/ドロップ両対応、ホバー時にハイライト
  - _Requirements: 6.1, 6.2_

- [x] 10.2 ファイル受け取り → パース → プレビュー
  - `file.arrayBuffer()` → `parseSalesWorkbook(buf, file.name)`
  - `ImportPreviewTabs`：集計 / 売掛 / スタッフ売上 / 固定経費 の 4 タブ表示
  - パースエラーは Alert で要約表示（先頭 5 件 + 残り件数）
  - ファイル名 regex 不一致は専用エラー UI で「もう一度」ボタン
  - _Requirements: 6.3, 6.4, 6.7_

- [x] 10.3 `UnknownCompanyResolver`
  - 純関数 `src/lib/billing/matchCompany.js`：`matchCompany`（name → alias → invoice_display_name 完全一致優先）+ `findCandidateCompanies`（部分一致候補、短い名前順、limit 対応）+ `resolveCompanyMap`（自動マッチ + UI 決定を統合）（13 テスト）
  - UI：自動マッチ済みは ✓ + マッチ種別を表示、未マッチは Select で「既存統合候補」/「スキップ」を選択
  - 「新規企業として追加」は取引先マスタから先に追加するよう disabled で誘導
  - _Requirements: 6.5_

- [x] 10.4 `DuplicateResolver`（重複マーキング + 月単位戦略）
  - 純関数 `src/lib/billing/duplicateReceivables.js`：`receivableKey(row)` + `findDuplicates(incoming, existing)`（既存重複 + incoming 内重複の 2 段階チェック）（7 テスト）
  - 売掛プレビューで重複行を Chip「重複」+ 行ハイライト
  - 同月既存データがある場合は `スキップ / 上書き / マージ` の RadioGroup
  - 発行済みデータがあると上書きは disabled、UI 側でも事前検出してエラー表示
  - _Requirements: 6.6, 6.10, 6.11_

- [x] 10.5 一括 import RPC
  - `supabase/migrations/20260603000000_add_import_rpc.sql`：`bulk_import_receivables(p_period, p_source_file, p_overwrite, p_daily_sales, p_staff_sales, p_receivables, p_fixed_expenses) → JSONB`
  - 上書き時に当月の `accounts_receivable.invoice_id` non-null チェック → エラー
  - 上書き時は 4 テーブルから当月分 DELETE → INSERT、マージ時は ON CONFLICT DO NOTHING
  - 戻り値で `inserted` / `deleted` の件数を返す
  - `authenticated` のみ EXECUTE 許可、`anon` REVOKE
  - _Requirements: 6.8, 6.9, 6.11_

- [x] 10.6 import 実行 + 結果サマリ
  - 純関数 `src/lib/billing/buildImportPlan.js`：camelCase パース結果 + companyMap + duplicates → snake_case の RPC ペイロード（summary に各種カウント）（8 テスト）
  - `src/services/billing/importService.js` + `src/hooks/billing/useBulkImportReceivables.js`：成功時に receivables / dailySales / staffSales / fixedExpenses クエリを invalidate
  - 結果 Alert に inserted / deleted / 重複スキップ / マッピング未解決スキップ の各件数を表示
  - 未マッピング残・上書き不可（請求済み）はクライアント側 guard で事前停止
  - _Requirements: 6.8, 6.9_

- [x] 10.7 ルーティング・メニュー登録
  - `App.jsx` に `/admin/receivables/import` を `ProtectedRoute` 配下で追加
  - 売掛画面の右上に「Excel インポート」ボタンを `variant="text"` で配置（要件通り目立たない位置）
  - グローバルナビには追加せず、売掛画面からのみ遷移できる導線
  - _Requirements: 既存統合_

---

## 11. 仕上げ

- [x] 11.1 (P) E2E スモークテスト
  - `src/__tests__/receivableBillingFlow.test.js`：純関数連結で「取引先追加 → 売掛入力 → 月次サマリ → 請求書発行 → 入金記録」の整合性を検証（2 テスト）
  - 取引先 alias 正規化 / 売掛バリデーション / Receivables CSV 出力 / 戦略選択 (NORMAL/MERGE/SPLIT) / 滞留日数判定 / Excel インポート (match + dedup + plan 構築) を一本化
  - DB/UI は触らず、各層のユニットテストとは独立した結合経路チェックとして機能
  - _Requirements: NFR-4_

- [x] 11.2 (P) 5 月分実データのインポート→請求書発行→鈴友請求書が手動版と一致 を結合テストで確認
  - `src/lib/excel/generateInvoice.test.js` → `generateInvoice.integration.test.js` に rename
  - `vite.config.js` の `test.exclude` に `**/*.integration.test.{js,jsx}` を追加して CI からは除外
  - `vitest.integration.config.js` + `package.json` の `test:integration` スクリプトで手動実行（実テンプレ + 実 Excel 揃いで 4/4 緑を確認）
  - _Requirements: Validation Targets_

- [x] 11.3 (P) ドキュメント
  - `docs/receivable-billing.md`：オーナー向け運用マニュアル
    - 画面一覧 / 日々の流れ（売掛入力・日次売上）/ 月次の流れ（請求書発行・入金記録・未入金確認）
    - 取引先マスタ / 自社情報 / 緊急時 Excel インポート手順
    - データ構造 / 一意性キー / 派生計算 / 認証 / 開発者向けメモ
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
