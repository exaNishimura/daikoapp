/**
 * シフト編集・シフトカレンダーで使う定数 + 純粋関数。
 * タイムライン開始は自社情報（予約開始と営業開始の早い方）。終了は翌営業終了。幅は 960px。
 * DOW_MAP は new Date().getDay() の 0(日)〜6(土) と対応。
 */

import { getOperatingHours, getTimelineStartHour } from '@/lib/operatingHours'

export const CAR_OPTIONS = ['1', '2']
export const ROLE_OPTIONS = ['代行', '随伴']
export const STATUS_OPTIONS = ['休業', '定休日']
export const DOW_MAP = ['日', '月', '火', '水', '木', '金', '土']

export const TIMELINE_WIDTH = 960

export function timelineStartHour() {
  return getTimelineStartHour()
}

export function timelineEndHour() {
  return getOperatingHours().businessEndHour
}

export function timelineSpanHours() {
  return 24 - timelineStartHour() + timelineEndHour()
}

export function pixelsPerHour() {
  return TIMELINE_WIDTH / timelineSpanHours()
}

/**
 * 時刻文字列 "HH:MM" をタイムライン開始を 0 とした分に変換する。
 * 終了時未満は翌日扱いで (24 - 開始 + h) * 60。
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  const start = timelineStartHour()
  if (hours >= start) {
    return (hours - start) * 60 + minutes
  }
  return (24 - start + hours) * 60 + minutes
}

export function minutesToPixels(minutes) {
  const span = timelineSpanHours()
  if (span <= 0) return 0
  return (minutes * TIMELINE_WIDTH) / (span * 60)
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

/** シフト保存時: 設定時間を planned_* にも反映 */
export function withPlannedShiftTimes({ start, end, ...rest }) {
  return {
    ...rest,
    start,
    end,
    planned_start: start,
    planned_end: end,
  }
}

/** コピー元から予定時間を取得（実績で上書きされた start/end は無視） */
export function getShiftPlannedTimesForCopy(shift) {
  const start = shift.planned_start ?? shift.start
  const end = shift.planned_end ?? shift.end
  return { start, end, planned_start: start, planned_end: end }
}

/**
 * 一括保存後にスクロールする日付。
 * 最後に編集し始めたシフトの日を優先し、なければ保存した日の先頭。
 */
export function resolveSaveScrollTarget(editingShifts, shiftIdToDateMap) {
  const savedDates = [...new Set(Object.values(shiftIdToDateMap).filter(Boolean))].sort()
  const lastEditedId = Object.keys(editingShifts).at(-1)
  return {
    dates: savedDates,
    targetDate: shiftIdToDateMap[lastEditedId] || savedDates[0] || null,
  }
}
