/**
 * シフト編集画面で使う定数 + 純粋関数
 *
 * - タイムラインは 19:00 開始 / 翌 06:00 終了の 12 時間を 960px に展開
 * - DOW_MAP は new Date().getDay() の 0(日)〜6(土) と対応
 */

export const CAR_OPTIONS = ['1', '2']
export const ROLE_OPTIONS = ['代行', '随伴']
export const STATUS_OPTIONS = ['休業', '定休日']
export const DOW_MAP = ['日', '月', '火', '水', '木', '金', '土']

export const TIMELINE_START = 19
export const TIMELINE_END = 6
export const TIMELINE_WIDTH = 960
export const PIXELS_PER_HOUR = TIMELINE_WIDTH / 12

/**
 * 時刻文字列 "HH:MM" を 19:00 を 0 とした分に変換。
 * 翌日扱いの 0:00–6:00 は (24 - 19 + h)*60 に展開する。
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  if (hours >= TIMELINE_START) {
    return (hours - TIMELINE_START) * 60 + minutes
  }
  return (24 - TIMELINE_START + hours) * 60 + minutes
}

export function minutesToPixels(minutes) {
  return (minutes / 60) * PIXELS_PER_HOUR
}

/**
 * 指定年月の日付一覧を返す
 * @returns {{ date: string, day: number, dow: string, isWeekend: boolean }[]}
 */
export function getDaysInMonth(year, month) {
  const days = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dow = DOW_MAP[date.getDay()]
    const isWeekend = dow === '土' || dow === '日'
    days.push({ date: dateStr, day, dow, isWeekend })
  }
  return days
}

/**
 * クエリ未指定時の表示月（ローカル日付基準・年・月は 1–12）。
 * 20 日以降は翌月、19 日以前は当月。
 */
export function getDefaultShiftEditYearMonth(reference = new Date()) {
  if (reference.getDate() >= 20) {
    const d = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  return {
    year: reference.getFullYear(),
    month: reference.getMonth() + 1,
  }
}
