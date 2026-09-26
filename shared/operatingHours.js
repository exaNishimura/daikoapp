/**
 * 営業夜の開始時刻。自社情報 (company_profile) から上書きする。
 * 予約開始と営業開始は別。終了は翌 06:00 固定（深夜帯の日跨ぎ計算が壊れない範囲）。
 */

export const BUSINESS_END_HOUR = 6
export const DEFAULT_RESERVATION_START_HOUR = 19
export const DEFAULT_BUSINESS_START_HOUR = 20
export const MIN_START_HOUR = 7
export const MAX_START_HOUR = 23

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function clampStartHour(value, fallback) {
  const hour = Number(value)
  if (!Number.isInteger(hour) || hour < MIN_START_HOUR || hour > MAX_START_HOUR) return fallback
  return hour
}

/**
 * @param {object | null | undefined} source company_profile 行、または camelCase
 * @returns {{ reservationStartHour: number, businessStartHour: number, businessEndHour: number }}
 */
export function resolveOperatingHours(source) {
  return {
    reservationStartHour: clampStartHour(
      source?.reservationStartHour ?? source?.reservation_start_hour,
      DEFAULT_RESERVATION_START_HOUR
    ),
    businessStartHour: clampStartHour(
      source?.businessStartHour ?? source?.business_start_hour,
      DEFAULT_BUSINESS_START_HOUR
    ),
    businessEndHour: BUSINESS_END_HOUR,
  }
}

/**
 * 配車表・シフト軸の先頭。予約開始の方が早ければ、その時刻から描く。
 * @param {object | null | undefined} source
 * @returns {number}
 */
export function timelineStartHour(source) {
  const hours = resolveOperatingHours(source)
  return Math.min(hours.reservationStartHour, hours.businessStartHour)
}

/**
 * startHour から翌 endHour の手前まで。例: 19 → [19..23, 0..5]
 * @param {number} startHour
 * @param {number} [endHour]
 * @returns {number[]}
 */
export function buildOvernightHours(startHour, endHour = BUSINESS_END_HOUR) {
  const hours = []
  for (let hour = startHour; hour < 24; hour += 1) hours.push(hour)
  for (let hour = 0; hour < endHour; hour += 1) hours.push(hour)
  return hours
}

/**
 * 深夜帯ウィンドウ。開始時以降、または終了時未満。
 * @param {number} hour
 * @param {number} startHour
 * @param {number} [endHour]
 * @returns {boolean}
 */
export function isHourInWindow(hour, startHour, endHour = BUSINESS_END_HOUR) {
  return hour >= startHour || hour < endHour
}

/**
 * 15分刻みの行数。終了時そのものは含めない。
 * @param {number} startHour
 * @param {number} [endHour]
 * @returns {number}
 */
export function timelineRowCount(startHour, endHour = BUSINESS_END_HOUR) {
  return (24 - startHour + endHour) * 4
}

/**
 * @param {number} hour
 * @param {number} [minute]
 * @returns {string} HH:MM
 */
export function formatHourClock(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
