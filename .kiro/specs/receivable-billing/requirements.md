# Requirements Document

## Introduction

本仕様書は、運転代行チョロ急の **売掛管理・月次請求書発行・日次売上集計** を Excel 運用から `daikoapp`（既存の React + Vite + Supabase アプリ）へ移行するための要件を定義する。

**ゴールは Excel 運用からの脱却**である。日々の売掛発生・売上計上・経費入力は web アプリで行い、月末に請求書 Excel ファイルを企業ごとに自動生成する（取引先に渡す体裁は維持）。Excel インポートは過去データの初期移行と障害時の復旧用に限定し、定常運用ルートではない。

## Project Description (Input)

`source-prompt.md` を参照。

## Glossary

| 用語 | 定義 |
|---|---|
| 売掛（accounts receivable） | 請求書発行前の未請求売上明細 1 件分 |
| 請求書（invoice） | 1 企業 × 1 ヶ月分の売掛をまとめた請求文書 |
| 請求月（billing_month） | 売掛の所属月（売上計上月）。月初日（YYYY-MM-01）で正規化して保持する |
| 取引先（company） | 請求書の宛先となる企業。表記ゆれを `aliases` で吸収する |
| 集計シート | `稼働管理表new.xlsx` の「集計」シート。日次売上・経費・スタッフ稼働時間 |
| 売掛シート | 同ファイルの「売掛」シート。企業ブロック × 明細行 |
| 自社情報（company_profile） | 請求書ヘッダに刷り込む発行元情報。シングルトン |
| 月額固定経費 | 共済掛金・損害保険・駐車場・携帯・税理士など売上独立の月次費用 |

## Stakeholders / Users

- **オーナー（管理者）**: チョロモン氏 1 名。配車・売上計上・売掛入力・請求書発行・入金管理すべてを行う
- 認証は既存 Supabase Auth の管理者ロール。RLS で `authenticated` のみが本機能のテーブルを操作可能

## Requirements

### Requirement 1: 取引先マスタ管理

**User Story:** 管理者として、請求書宛先となる取引先を登録・編集できるようにしたい。表記ゆれ（「鈴友」「株式会社 鈴友」など）を吸収して、売掛集計を正確に保ちたい。

#### Acceptance Criteria

1. WHEN 管理者が `/admin/companies` を開く THEN システムは取引先一覧を `display_order` 昇順で表示する
2. WHEN 管理者が「新規追加」を実行する THEN システムは `name`（マスタ名・必須）`invoice_display_name`（請求書表記・任意、空なら name 使用）`aliases`（別名配列・任意）`display_order`（数値）`is_active`（boolean、デフォルト true）`memo` を保存する
3. IF `name` が既存と重複する THEN システムはエラー「取引先名は重複できません」を表示し保存を中止する
4. WHEN 管理者が `display_order` をドラッグで並び替える THEN システムは即座に永続化する
5. WHEN 管理者が「削除」を実行する THEN システムは物理削除ではなく `is_active=false` に更新する（売掛履歴を維持するため）
6. WHEN 管理者が `aliases` に値を追加する THEN システムは半角/全角・前後空白を正規化して保存する
7. WHEN 売掛・請求書一覧で取引先名を表示する THEN システムは `is_active=false` の企業もデータが残っていれば表示し、（無効）バッジを付与する

### Requirement 2: 売掛明細の手入力（日々の運用ルート）

**User Story:** 管理者として、日々発生した売掛明細を web 上で直接登録・編集・削除したい。Excel に戻らず完結したい。

#### Acceptance Criteria

1. WHEN 管理者が `/admin/receivables` を開く THEN システムは当月の売掛明細を新しい順に表示する
2. WHEN 管理者が「行追加」を実行する THEN システムは `company_id`（必須）`work_date`（必須、当月内）`departure`（任意）`destination`（任意）`amount`（必須、整数）`note`（任意）を入力するインライン行を表示する
3. WHEN 管理者が `amount` に「2000」「2,000」「¥2,000」のいずれかを入力する THEN システムは整数 `2000` として保存する
4. WHEN 管理者が「保存」を実行する THEN システムは `billing_month`（`work_date` の月初）`source_file=null`（手入力フラグ）`imported_at=now()` を自動付与し永続化する
5. WHEN 管理者が既存行を編集する THEN システムはインラインで変更可能とし、`updated_at` を更新する
6. IF 該当行が `invoice_id` を持つ（請求書発行済み） THEN システムは編集を不可とし「請求書発行済みのため編集できません。請求書を取り消すと編集可能になります」と表示する
7. WHEN 管理者が「削除」を実行する THEN システムは確認ダイアログを出し、承認後に物理削除する（請求書発行前のみ）
8. WHEN 一覧上部で「月選択」「企業選択」「請求済/未請求/全て」「入金済/未入金/全て」のフィルタを切り替える THEN システムは即座に絞り込み結果を表示する
9. WHEN 一覧の合計表示エリアを見る THEN システムは現在のフィルタ結果に対する `件数` `合計金額` `企業別合計` を表示する
10. WHEN 管理者が「CSV エクスポート」を実行する THEN システムは現在のフィルタ結果を UTF-8 BOM 付き CSV でダウンロードさせる

### Requirement 3: 月次請求書の一括発行

**User Story:** 管理者として、月末に「YYYY 年 MM 月分の請求書を発行」を 1 クリックで実行し、企業別の請求書 Excel を一括ダウンロードしたい。

#### Acceptance Criteria

1. WHEN 管理者が `/admin/invoices` を開き「YYYY 年 MM 月の請求書を発行」を選択する THEN システムは未請求の売掛を企業別にグループ化したプレビューを表示する
2. WHEN プレビュー画面で表示される THEN システムは企業ごとに `件数` `合計金額` `対象チェックボックス`（デフォルト on）を一覧する
3. IF 件数が 0 の企業がある THEN システムはその企業を一覧から除外する
4. IF 件数が 19 件以上の企業がある THEN システムはその企業をハイライトして「明細が 18 件を超えています。請求書テンプレの行数を超過するため、対応方針を選択してください」と警告し `スキップ` `合算（"その他" として 1 行に集約）` `分割（複数枚に分ける）` のいずれかを選択させる
5. WHEN 管理者が「発行」を実行する THEN システムは選択された各企業に対し `invoices` レコードを作成し、紐付く `accounts_receivable.invoice_id` を更新する
6. IF 同じ `(company_id, billing_month)` の請求書が既に存在する THEN システムはエラー「YYYY 年 MM 月の請求書は既に発行済みです」を表示し処理を中断する（再発行は明示的な取消後）
7. WHEN 発行が完了する THEN システムは ExcelJS でテンプレ `src/assets/invoice-template.xlsx` を読み込み、各企業に対しセル位置仕様（source-prompt.md 参照）に従って値を埋め、`YYYYMM-{invoice_display_name}.xlsx` で保存する
8. WHEN 複数企業の請求書を発行した THEN システムはすべてを zip で一括ダウンロードできるリンクと、企業ごとの個別ダウンロードリンクを表示する
9. WHEN ファイルが保存される THEN システムは Supabase Storage の `invoices/YYYY/MM/` 配下に同じファイルを保存し、`invoices.file_path` に永続パスを記録する（再ダウンロード可能とするため）
10. WHEN 既発行の請求書一覧で「ダウンロード」を実行する THEN システムは Storage 上のファイルを取得して再ダウンロードさせる
11. WHEN 既発行の請求書で「取消」を実行する THEN システムは確認ダイアログを出し、承認後に `invoices` レコードを削除し `accounts_receivable.invoice_id` を null に戻す（売掛は残る）

### Requirement 4: 日次売上ダッシュボード

**User Story:** 管理者として、車両別・スタッフ別の日次売上と経費を web で入力・閲覧し、月次の粗利を即座に確認したい。

#### Acceptance Criteria

1. WHEN 管理者が `/admin/sales` を開く THEN システムは月選択 UI と当月の日次売上テーブルを表示する
2. WHEN 月を切り替える THEN システムは選択月の `daily_sales` レコードを表示する
3. WHEN 管理者が日付セルを編集する THEN システムは `vehicle1_distance_km` `vehicle2_distance_km` `vehicle1_fuel_yen` `vehicle2_fuel_yen` `vehicle1_sales` `vehicle2_sales` `vehicle3_sales` `expense_note` `expense_amount` `cash` の各列をインライン編集可能とする
4. WHEN 値を入力する THEN システムは `total_sales = vehicle1_sales + vehicle2_sales + vehicle3_sales` を自動再計算し、`profit = total_sales - expense_amount - 燃料代合計` を即座に表示する
5. WHEN スタッフ別売上タブを開く THEN システムは `daily_staff_sales` を `(work_date, staff_name)` で集計表示する
6. WHEN 月次サマリエリアを見る THEN システムは `総売上合計` `売掛合計` `現金合計` `経費合計` `スタッフ別人件費（時間制 = 稼働時間 × 単価、歩合制 = 売上 × 掛率）` `月額固定経費合計` `推定粗利` を表示する
7. WHEN 月額固定経費（共済掛金 / 損害保険 / 駐車場 / 携帯 / 税理士）の入力欄に値を入れる THEN システムは `monthly_fixed_expenses` に `(billing_month, label, amount)` で永続化する
8. WHEN スタッフの単価設定が変わる THEN 既存の `daily_staff_sales` は変更しないが、再計算時には最新の `staff_rates` 設定に従う
9. WHERE 燃料代計算ブロック（推定燃費・推定使用量）は表示のみで、自動計算する

### Requirement 5: 入金管理

**User Story:** 管理者として、発行済み請求書に対する入金を記録し、未入金一覧を即座に把握したい。

#### Acceptance Criteria

1. WHEN 管理者が請求書一覧で「入金済」チェックを on にする THEN システムは `invoices.paid_at = now()` を記録する
2. WHEN 「入金済」を off に戻す THEN システムは `paid_at = null` を記録する
3. WHEN `paid_at` を任意の日付に変更したい THEN システムは日付ピッカーで編集可能とする
4. WHEN 管理者が「未入金一覧」を選択する THEN システムは `paid_at IS NULL` の請求書を `billing_month` 昇順で表示する
5. WHEN 未入金一覧の集計エリアを見る THEN システムは `企業別未収金合計` `総未収金額` `平均滞留日数（issue_date から今日までの日数）` を表示する
6. WHEN 滞留日数が 60 日を超える請求書がある THEN システムは赤バッジでアラート表示する

### Requirement 6: Excel インポート（過去データ移行・運用復旧用）

**User Story:** 管理者として、過去の Excel ファイル（`YYYYMM稼働管理表new.xlsx`）を取り込み、既存履歴を一括で DB へ移行したい。

#### Acceptance Criteria

1. WHEN 管理者が `/admin/receivables/import` を開く THEN システムは「このページは初期データ移行用です。日々の運用は売掛画面から直接入力してください」と注意書きを表示する
2. WHEN 管理者が `.xlsx` ファイルをドロップする THEN システムはファイル名から年月を正規表現で抽出する
3. IF ファイル名が `^(\d{4})(\d{2})稼働管理表` に一致しない THEN システムはエラー「ファイル名が `YYYYMM稼働管理表` 形式ではありません」を表示する
4. WHEN ファイルを読み込む THEN システムは「集計」「売掛」両シートをパースし、プレビューを 2 タブで表示する
5. WHEN 売掛シートの企業名が `companies.name` または `companies.aliases` のいずれにも一致しない THEN システムはモーダルで `新規企業として追加` `既存企業に統合（候補リスト表示）` `スキップ` を選択させる
6. WHEN 売掛行が既存と完全重複する（`(billing_month, company_id, work_date, departure, destination, amount)` の一意性キー一致） THEN システムは「重複（スキップ）」マークを付ける
7. WHEN 値のパースに失敗した行がある THEN システムはエラーリストに追加し、「エラー以外を保存」「すべて中止」を選択させる
8. WHEN 管理者が「保存」を実行する THEN システムは `accounts_receivable` `daily_sales` `daily_staff_sales` `monthly_fixed_expenses` の 4 テーブルにトランザクションで挿入する
9. WHEN 保存が完了する THEN システムは各レコードに `source_file=ファイル名` `imported_at=now()` を記録する
10. WHEN 同月の Excel を再アップロードする THEN システムは「同月のデータが既に存在します」と通知し、`スキップ` `上書き（既存削除→新規挿入）` `マージ（差分のみ追加）` を選択させる
11. IF `accounts_receivable.invoice_id` が non-null の行が上書き対象に含まれる THEN システムは警告「請求書発行済みデータが含まれます。先に該当請求書を取消してください」を表示し処理を中断する

### Requirement 7: 自社情報（発行元）の管理

**User Story:** 管理者として、請求書ヘッダに刷り込む自社情報（屋号・住所・インボイス番号・振込先）を変更可能にしたい。

#### Acceptance Criteria

1. WHEN 管理者が `/admin/company-profile` を開く THEN システムは `company_profile` シングルトンの編集フォームを表示する
2. WHEN 管理者が値を変更し「保存」を実行する THEN システムは既存レコードを更新する（id 固定の 1 行）
3. WHEN 請求書を発行する THEN システムは `company_profile` の最新値を埋め込む
4. WHEN テーブルが空の場合（初期セットアップ時） THEN システムは初期マイグレーションで規定値（source-prompt.md 自社固定情報）を 1 行投入する

### Requirement 8: パフォーマンス・監査・セキュリティ

#### Acceptance Criteria

1. WHEN 1 ヶ月分（〜200 行）の Excel をパースする THEN システムは 1 秒以内に完了する
2. WHEN 15 社一括で請求書を生成する THEN システムは 5 秒以内にすべての .xlsx を生成する
3. WHEN レコードが作成・更新される THEN システムは `created_at` `updated_at` を自動記録する（既存 trigger を流用）
4. WHEN 売掛・請求書テーブルにアクセスする THEN システムは RLS により `authenticated` ロールのみを許可する
5. WHEN エラーが発生する THEN システムは行番号・シート名・列名付きでエラー内容を表示する
6. WHERE Excel 入力ファイル（`excel-imports/**/*.xlsx`）は `.gitignore` 済みで、Git 履歴に売上データを含めない
7. WHEN ファイル名や企業名に日本語・漢字が含まれる THEN システムは UTF-8 で保存・配信する（Windows ファイルシステム連携時の Shift-JIS 化を防ぐ）

## Non-Functional Requirements

### NFR-1: 整合性

- `accounts_receivable.invoice_id` が non-null の行は、対応する `invoices` レコードが存在しなければならない（外部キー制約）
- `(invoices.company_id, invoices.billing_month)` の組はユニーク
- `(accounts_receivable.billing_month, company_id, work_date, departure, destination, amount)` の組はユニーク（重複インポート防止）

### NFR-2: 監査

- すべてのテーブルに `source_file`（手入力なら null、Excel 取り込みなら元ファイル名）`imported_at` を保持
- 削除はソフト削除を原則とする。ただし発行前の売掛、未発行の `daily_sales`、企業マスタの新規エントリは物理削除可

### NFR-3: i18n / エンコーディング

- すべての出力 .xlsx ファイル名は UTF-8、`Content-Disposition` ヘッダで RFC 5987 準拠
- 内部処理は UTF-8 で統一、Shift-JIS 変換は行わない

### NFR-4: テスタビリティ

- パース・生成系（`src/lib/excel/`）は単体テストで実データ（5 月分）の検証ターゲットを満たす
- UI 系は React Testing Library で主要操作のスモーク

## Out of Scope (v1)

- 複数管理者ロール / 権限分離
- 他通貨対応
- 領収書発行 / 売上前受金 / 仕訳出力
- 取引先への請求書メール送信（手動ダウンロード→送付の運用は維持）
- 自動仕訳・会計ソフト連携（freee / マネーフォワード等）
- 月次以外の請求サイクル（締め日カスタマイズ）
- スマホ最適化（PC ブラウザでの利用を優先）

## Validation Targets（受け入れ基準・実データ検証）

`excel-imports/sales/202605稼働管理表new.xlsx` を取り込んだ結果が以下と一致すること：

| 検証項目 | 期待値 |
|---|---|
| 売掛全体の月合計（F3 セル相当） | ¥104,000 |
| 総売上（AC 列合計） | ¥826,500 |
| 鈴友の月合計（8 件） | ¥27,000 |
| 鈴友 5/8 算所→旭が丘 | ¥3,000 |
| 鈴友 5/18 白子→旭が丘 備考「P1000円　一ノ宮経由」 | ¥8,500 |
| 5/1 燃料代 1 号車 | ¥3,000 |
| 5/1 西村稼働時間 | 9.50h |
| 取引先 15 社のマスタ自動生成 | OK |
| 鈴友請求書出力（`202605-鈴友.xlsx`）が `excel-imports/templates/202605鈴友.xlsx` とセル単位で一致（書式は除く） | OK |
