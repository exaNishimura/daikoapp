import {
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  formatWorkDateKey,
  getBusinessDayBoundaries,
  isWithinBusinessHours,
} from '@/utils/businessDayUtils'
import { combineOvernightPickup } from '@/utils/liffPickupTime'

/** 営業夜の時（18:00 → 翌 05 時台） */
export const RESERVATION_HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5]

export const RESERVATION_MINUTES = [0, 15, 30, 45]

/**
 * @param {number} hour
 * @returns {string}
 */
export function formatReservationHourLabel(hour) {
  if (hour === 0) return '0時（深夜）'
  if (hour >= 1 && hour < BUSINESS_END_HOUR) return `${hour}時（翌朝）`
  return `${hour}時`
}

/**
 * @param {number} minute
 * @returns {string}
 */
export function formatReservationMinuteLabel(minute) {
  return `${String(minute).padStart(2, '0')}分`
}

function snapHourMinute(date) {
  let hour = date.getHours()
  let minute = Math.round(date.getMinutes() / 15) * 15
  if (minute === 60) {
    minute = 0
    hour += 1
  }
  if (hour === 24) hour = 0
  if (hour === BUSINESS_END_HOUR && minute === 0) {
    hour = BUSINESS_END_HOUR - 1
    minute = 45
  }
  return { hour, minute }
}

/**
 * 新規登録の初期値。営業時間内なら今を 15 分刻み、外ならその営業夜の 18:00。
 * @param {Date} [now]
 * @returns {{ date: string, hour: number, minute: number }}
 */
export function defaultReservationDateTime(now = new Date()) {
  const { businessDay } = getBusinessDayBoundaries(now)
  const date = formatWorkDateKey(businessDay)
  if (!isWithinBusinessHours(now)) {
    return { date, hour: BUSINESS_START_HOUR, minute: 0 }
  }
  const { hour, minute } = snapHourMinute(now)
  return { date, hour, minute }
}

/**
 * 保存済み ISO を営業日 + 時分に分解する。0〜5 時は前日が営業日。
 * @param {string} [iso]
 * @param {Date} [now]
 * @returns {{ date: string, hour: number, minute: number }}
 */
export function splitReservationDateTime(iso, now = new Date()) {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return defaultReservationDateTime(now)
  const { businessDay } = getBusinessDayBoundaries(d)
  const { hour, minute } = snapHourMinute(d)
  return { date: formatWorkDateKey(businessDay), hour, minute }
}

/**
 * 営業日と時分を UTC ISO にする。0〜5 時は翌朝の暦日。
 * @param {string} date
 * @param {number|string} hour
 * @param {number|string} minute
 * @returns {string}
 */
export function buildReservationIso(date, hour, minute) {
  const dt = combineOvernightPickup(date, hour, minute)
  return dt ? dt.toISOString() : ''
}

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatReservationInstantLabel(iso) {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  const hour = d.getHours()
  const minute = d.getMinutes()
  const time =
    minute === 0 ? `${hour}時` : `${hour}時${String(minute).padStart(2, '0')}分`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
}
