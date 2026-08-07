/**
 * 数値・日付を Excel テンプレに刷り込むための文字列にフォーマットする純関数群。
 *
 * 出力例（請求書テンプレ仕様 `_analysis-template.txt` より）:
 *   - 料金セル:  "¥3,000"
 *   - 合計セル:  "¥27,000- "  (末尾ハイフン + 半角スペース付き)
 *   - 日付セル:  "2026年05月08日" (請求日は "2026年5月31日" と非ゼロパディング)
 *   - 番号セル:  "1 "  (半角スペース付き)
 */

/**
 * 整数を "¥X,XXX" 形式に整形する。
 * @param {number | null | undefined} amount
 * @returns {string} amount が null/undefined/NaN の場合は空文字
 */
export function formatYen(amount) {
  if (amount == null || !Number.isFinite(amount)) return ''
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(amount))
  return `${sign}¥${abs.toLocaleString('en-US')}`
}

/**
 * 整数を請求書合計用 "¥XX,XXX- " (末尾ハイフン + 半角スペース) に整形する。
 * 既存テンプレ "¥27,000- " の形に合わせる。
 * @param {number | null | undefined} amount
 * @returns {string}
 */
export function formatYenWithDash(amount) {
  const base = formatYen(amount)
  if (!base) return ''
  return `${base}- `
}

/**
 * 日付を請求書明細用 "YYYY年MM月DD日" (ゼロパディング) に整形する。
 * @param {Date | null | undefined} date
 * @returns {string}
 */
export function formatJpDatePadded(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}年${m}月${d}日`
}

/**
 * 日付を請求日見出し用 "YYYY年M月D日" (非ゼロパディング) に整形する。
 * @param {Date | null | undefined} date
 * @returns {string}
 */
export function formatJpDate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return ''
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}年${m}月${d}日`
}

/**
 * 明細 No. を "1 " (半角スペース付き) に整形する。
 * テンプレ既存表記に合わせるため。
 * @param {number} n
 * @returns {string}
 */
export function formatLineNumber(n) {
  if (!Number.isFinite(n)) return ''
  return `${Math.trunc(n)} `
}

/**
 * 月初日（YYYY-MM-01）を返す。billing_month の DB 制約 (CHECK day=1) に合わせる。
 * @param {number} year
 * @param {number} month 1-12
 * @returns {Date}
 */
export function monthStart(year, month) {
  return new Date(year, month - 1, 1)
}

/**
 * 月末日を返す。請求書の発行日として使う。
 * @param {number} year
 * @param {number} month 1-12
 * @returns {Date}
 */
export function monthEnd(year, month) {
  return new Date(year, month, 0)
}

/**
 * Date をローカル日付の 'YYYY-MM-DD' に整形する。
 * toISOString() は UTC 変換で JST だと日付が 1 日ずれるため使わない。
 * @param {Date | null | undefined} date
 * @returns {string}
 */
export function formatIsoDate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 請求書の発行日を決める。
 * - 対象月の月中（月初〜月末前日）に発行 → 当日
 * - 月末当日以降、または対象月外 → 対象月末日
 *
 * @param {number} year
 * @param {number} month 1-12
 * @param {Date} [today=new Date()]
 * @returns {Date}
 */
export function resolveIssueDate(year, month, today = new Date()) {
  const start = monthStart(year, month)
  const end = monthEnd(year, month)
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (todayLocal >= start && todayLocal < end) {
    return todayLocal
  }
  return end
}
