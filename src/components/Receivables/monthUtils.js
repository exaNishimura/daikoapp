const MONTH_STRING_RE = /^(\d{4})-(\d{2})$/

/**
 * `{ year, month }` または Date を 'YYYY-MM' 文字列へ変換する。
 * 不正な入力は null を返す。
 */
export function toMonthString(input) {
  if (input == null) return null
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    const y = input.getFullYear()
    const m = input.getMonth() + 1
    return `${y}-${String(m).padStart(2, '0')}`
  }
  const { year, month } = input
  if (typeof year !== 'number' || typeof month !== 'number') return null
  if (month < 1 || month > 12) return null
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * 'YYYY-MM' 文字列を `{ year, month }` へ。
 * 不正な入力は null。
 */
export function fromMonthString(s) {
  if (typeof s !== 'string') return null
  const m = s.match(MONTH_STRING_RE)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

/**
 * dayjs 互換オブジェクトを 'YYYY-MM' 文字列へ。
 * - null / undefined → null
 * - `isValid()` が false なら null
 * - 有効な dayjs → 'YYYY-MM'
 *
 * MUI X DatePicker の onChange ハンドラ用ヘルパ。
 */
export function dayjsToMonthString(dayjsValue) {
  if (dayjsValue == null) return null
  if (typeof dayjsValue.isValid !== 'function') return null
  if (!dayjsValue.isValid()) return null
  if (typeof dayjsValue.format !== 'function') return null
  return dayjsValue.format('YYYY-MM')
}

/**
 * 'YYYY-MM' から月初日・月末日 ('YYYY-MM-DD') を返す。
 * うるう年も含めて Date 演算で算出する。
 */
export function monthRange(s) {
  const parsed = fromMonthString(s)
  if (!parsed) return null
  const { year, month } = parsed
  const lastDate = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  return {
    firstDay: `${year}-${mm}-01`,
    lastDay: `${year}-${mm}-${String(lastDate).padStart(2, '0')}`,
  }
}

/**
 * DateInput の min/max 用。実在しない日付 (9/31 等) を渡すと Astryx が throw する。
 * @returns {{ min?: string, max?: string }}
 */
export function dateInputMonthBounds(year, month) {
  const range = monthRange(toMonthString({ year, month }))
  if (!range) return {}
  return { min: range.firstDay, max: range.lastDay }
}
