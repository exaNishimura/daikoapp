import { formatWorkDateKey, getBusinessDayBoundaries } from '@/utils/businessDayUtils'

/** 顧客向けお迎え時刻（20:00 〜 翌 05 時台） */
export const LIFF_PICKUP_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5]

/** 「今すぐ」を出せる時間帯（電話受付と同じ 19:00〜翌06:00） */
export const LIFF_NOW_START_HOUR = 19
export const LIFF_NOW_END_HOUR = 6

/**
 * 「今すぐ」が受付可能か（19:00〜翌06:00）
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isLiffNowAvailable(now = new Date()) {
  const hour = now.getHours()
  return hour >= LIFF_NOW_START_HOUR || hour < LIFF_NOW_END_HOUR
}

/** 配車グリッドに合わせた 15 分刻み */
export const LIFF_PICKUP_MINUTES = [0, 15, 30, 45]

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @param {number} hour
 * @returns {string}
 */
export function formatLiffHourLabel(hour) {
  if (hour === 0) return '0時（深夜）'
  if (hour >= 1 && hour <= 5) return `${hour}時（翌朝）`
  return `${hour}時`
}

/**
 * @param {number} minute
 * @returns {string}
 */
export function formatLiffMinuteLabel(minute) {
  return `${String(minute).padStart(2, '0')}分`
}

function hasPickupParts(dateStr, hour, minute) {
  return Boolean(dateStr) && hour !== '' && hour != null && minute !== '' && minute != null
}

/**
 * 希望日はその夜（営業日）。0〜5時は翌日のカレンダー日付になる。
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number|string} hour
 * @param {number|string} minute
 * @returns {Date|null}
 */
export function combineOvernightPickup(dateStr, hour, minute) {
  if (!hasPickupParts(dateStr, hour, minute)) return null
  const hourNum = Number(hour)
  const minuteNum = Number(minute)
  if (!Number.isFinite(hourNum) || !Number.isFinite(minuteNum)) return null

  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null

  const [year, month, day] = parts
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (hourNum <= 5) date.setDate(date.getDate() + 1)
  date.setHours(hourNum, minuteNum, 0, 0)
  return date
}

/**
 * 深夜帯（06:00 未満）は「その夜」の営業日を最小日付にする
 * @param {Date} [now]
 * @returns {string} "YYYY-MM-DD"
 */
export function getMinLiffPickupDate(now = new Date()) {
  return formatWorkDateKey(getBusinessDayBoundaries(now).businessDay)
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function calendarDayDiff(from, to) {
  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS)
}

function formatTimeLabel(date) {
  const hour = date.getHours()
  const minute = date.getMinutes()
  if (minute === 0) return `${hour}時`
  return `${hour}時${minute}分`
}

/**
 * 申込確認ダイアログの文言。
 * - 今すぐ: 固定文
 * - 同日かつ 24 時間未満: 「○時間○分後」（1時間未満は「○分後」、0分は「○時間後」）
 * - 日またぎ、または 24 時間以上: 「○日後（○月○日）○時」
 * @param {Date|null} pickupAt
 * @param {{ now?: Date, orderType?: 'NOW' | 'SCHEDULED' }} [options]
 * @returns {string}
 */
export function formatLiffPickupConfirmMessage(pickupAt, options = {}) {
  const now = options.now ?? new Date()
  if (options.orderType === 'NOW') {
    return '今すぐのご予約でよろしいでしょうか？'
  }
  if (!(pickupAt instanceof Date) || Number.isNaN(pickupAt.getTime())) return ''
  if (pickupAt.getTime() <= now.getTime()) return ''

  const dayDiff = calendarDayDiff(now, pickupAt)
  const over24h = pickupAt.getTime() - now.getTime() >= DAY_MS
  const timeLabel = formatTimeLabel(pickupAt)

  if (dayDiff >= 1 || over24h) {
    const month = pickupAt.getMonth() + 1
    const day = pickupAt.getDate()
    return `${dayDiff}日後（${month}月${day}日）${timeLabel}のご予約でよろしいでしょうか？`
  }

  const diffMin = Math.max(1, Math.round((pickupAt.getTime() - now.getTime()) / 60000))
  const hours = Math.floor(diffMin / 60)
  const minutes = diffMin % 60
  const later =
    hours === 0 ? `${minutes}分後` : minutes === 0 ? `${hours}時間後` : `${hours}時間${minutes}分後`
  return `${later}のご予約でよろしいでしょうか？`
}

/**
 * 「今すぐ」不可時に案内する最短お迎え（次の 20:00・ローカル）
 * @param {Date} [now]
 * @returns {Date}
 */
export function nextLiffPickupAt(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0)
  if (now.getHours() >= 20) next.setDate(next.getDate() + 1)
  return next
}

/**
 * フォーム下の確定プレビュー
 * @param {Date|null} pickupAt
 * @returns {string}
 */
export function formatLiffPickupPreview(pickupAt) {
  if (!(pickupAt instanceof Date) || Number.isNaN(pickupAt.getTime())) return ''
  const month = pickupAt.getMonth() + 1
  const day = pickupAt.getDate()
  return `お迎え: ${month}月${day}日 ${formatTimeLabel(pickupAt)}`
}
