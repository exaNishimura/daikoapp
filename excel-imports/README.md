# excel-imports

エクセル取り込み用ディレクトリ。**実データ（個人情報・売上情報）はGit管理しない。**

## ディレクトリ構成

| ディレクトリ | 用途 |
| --- | --- |
| `sales/` | 売上明細エクセル（1月1シート構成） |
| `receivables/` | 売掛エクセル（請求書払いの依頼記録） |
| `templates/` | 請求書発行用のExcelテンプレート |

## 運用ルール

- 実ファイルはこのフォルダに置くが `.gitignore` で除外する
- サンプル/雛形ファイルだけ `*.sample.xlsx` という名前でコミット可
- ファイル名規則：
  - 売上: `sales-YYYYMM.xlsx`
  - 売掛: `receivables-YYYYMM.xlsx`（または通年1ファイルなら `receivables.xlsx`）
  - 請求書テンプレ: `invoice-template.xlsx`
