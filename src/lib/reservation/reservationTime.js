import { buildOvernightHours, getOperatingHours } from '@/lib/operatingHours'
import {
  formatWorkDateKey,
  getBusinessDayBoundaries,
  isWithinReservationHours,
} from '@/utils/businessDayUtils'
import { combineOvernightPickup } from '@/utils/liffPickupTime'

/** 予約開始から翌 05 時台まで */
export function getReservationHours() {
  const { reservationStartHour, businessEndHour } = getOperatingHours()
  return buildOvernightHours(reservationStartHour, businessEndHour)
}

export const RESERVATION_MINUTES = [0, 15, 30, 45]

/**
 * @param {number} hour
 * @returns {string}
 */
export function formatReservationHourLabel(hour) {
  if (hour === 0) return '0時（深夜）'
  if (hour >= 1 && hour < getOperatingHours().businessEndHour) return `${hour}時（翌朝）`
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
  const endHour = getOperatingHours().businessEndHour
  if (hour === endHour && minute === 0) {
    hour = endHour - 1
    minute = 45
  }
  return { hour, minute }
}

/**
 * 新規登録の初期値。予約時間内なら今を 15 分刻み、外ならその夜の予約開始。
 * @param {Date} [now]
 * @returns {{ date: string, hour: number, minute: number }}
 */
export function defaultReservationDateTime(now = new Date()) {
  const { businessDay } = getBusinessDayBoundaries(now)
  const date = formatWorkDateKey(businessDay)
  if (!isWithinReservationHours(now)) {
    return { date, hour: getOperatingHours().reservationStartHour, minute: 0 }
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

function formatDateTimeLocal(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${formatWorkDateKey(date)}T${hh}:${mi}`
}

/**
 * 営業日と時分を datetime-local（YYYY-MM-DDTHH:MM）にする。0〜5 時は翌朝の暦日。
 * @param {string} date
 * @param {number|string} hour
 * @param {number|string} minute
 * @returns {string}
 */
export function buildReservationDateTimeLocal(date, hour, minute) {
  const dt = combineOvernightPickup(date, hour, minute)
  return dt ? formatDateTimeLocal(dt) : ''
}

/**
 * 新規依頼の予約日時デフォルト（datetime-local）。
 * @param {Date} [now]
 * @returns {string}
 */
export function defaultReservationDateTimeLocal(now = new Date()) {
  const { date, hour, minute } = defaultReservationDateTime(now)
  return buildReservationDateTimeLocal(date, hour, minute)
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
  const time = minute === 0 ? `${hour}時` : `${hour}時${String(minute).padStart(2, '0')}分`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
}
