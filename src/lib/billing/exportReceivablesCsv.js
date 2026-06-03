/**
 * 売掛行の CSV エクスポート (純関数)。
 * - 文字列生成は純粋
 * - DOM 操作（Blob / a.click）は呼び出し側で行う
 *
 * 形式: UTF-8 BOM 付き、CRLF 区切り、RFC 4180 風のクォート
 */

export const RECEIVABLES_CSV_HEADERS = [
  'id',
  '請求月',
  '日付',
  '取引先',
  '出発',
  '到着',
  '金額',
  '備考',
  '請求状態',
  '入金状態',
]

const BOM = '\uFEFF'
const ROW_SEP = '\r\n'

/**
 * 単一の CSV フィールドをエスケープする。
 * - null/undefined → ''
 * - `,` `"` `\n` `\r` のいずれかを含むときダブルクォートでくるみ、内部 `"` は `""` に置換
 */
export function escapeCsvField(value) {
  if (value == null) return ''
  const s = String(value)
  if (s === '') return ''
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function invoiceLabel(row) {
  return row?.invoice_id != null ? '請求済' : '未請求'
}

function paidLabel(row) {
  if (!row?.invoice_id) return '—'
  return row?.invoices?.paid_at ? '入金済' : '未入金'
}

/**
 * 売掛行を UTF-8 BOM 付き CSV 文字列に変換する。
 *
 * @param {Array} rows  accounts_receivable の行（companies/invoices が join 済み想定）
 * @returns {string}    BOM 始まりの CSV テキスト
 */
export function buildReceivablesCsv(rows) {
  const lines = []
  lines.push(RECEIVABLES_CSV_HEADERS.map(escapeCsvField).join(','))

  if (Array.isArray(rows)) {
    for (const row of rows) {
      const fields = [
        row?.id,
        row?.billing_month,
        row?.work_date,
        row?.companies?.invoice_display_name || row?.companies?.name || '',
        row?.departure,
        row?.destination,
        row?.amount,
        row?.note,
        invoiceLabel(row),
        paidLabel(row),
      ]
      lines.push(fields.map(escapeCsvField).join(','))
    }
  }

  return BOM + lines.join(ROW_SEP) + ROW_SEP
}
