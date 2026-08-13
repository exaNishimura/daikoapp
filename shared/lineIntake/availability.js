/**
 * 可否判定エンジン（純関数・Maps/DB 依存は呼び出し側）
 */

import { totalDurationWithBuffer } from './buffer.js'
import { evaluateOccupancy, resolveCapacityForDay } from './capacity.js'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const PHONE_INTAKE_HOUR = 19
const BUSINESS_END_HOUR = 6
/** LIFF 顧客が選べる最初の時（20:00 JST） */
const LIFF_PICKUP_START_HOUR = 20

/**
 * @param {Date} date
 */
function jstParts(date) {
  const jst = new Date(date.getTime() + JST_OFFSET_MS)
  return {
    y: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    d: jst.getUTCDate(),
    hour: jst.getUTCHours(),
  }
}

/**
 * 営業日キー YYYY-MM-DD（電話受付 19:00 起算: 06:00 未満は前日）
 * @param {Date} at
 * @returns {string}
 */
export function getLineBusinessDayKey(at) {
  const p = jstParts(at)
  let y = p.y
  let month = p.month
  let d = p.d
  if (p.hour < BUSINESS_END_HOUR) {
    const prev = new Date(Date.UTC(y, month - 1, d - 1))
    y = prev.getUTCFullYear()
    month = prev.getUTCMonth() + 1
    d = prev.getUTCDate()
  }
  return `${y}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * @param {Date} now
 * @returns {boolean} 電話受付時間内（>=19 or <6）
 */
export function isPhoneIntakeOpen(now) {
  const { hour } = jstParts(now)
  return hour >= PHONE_INTAKE_HOUR || hour < BUSINESS_END_HOUR
}

/**
 * 「今すぐ」不可時に案内する最短お迎え（次の 20:00 JST）
 * @param {Date} now
 * @returns {Date}
 */
export function nextLiffPickupAt(now) {
  const p = jstParts(now)
  let y = p.y
  let month = p.month
  let d = p.d
  if (p.hour >= LIFF_PICKUP_START_HOUR) {
    const next = new Date(Date.UTC(y, month - 1, d + 1))
    y = next.getUTCFullYear()
    month = next.getUTCMonth() + 1
    d = next.getUTCDate()
  }
  return new Date(Date.UTC(y, month - 1, d, LIFF_PICKUP_START_HOUR - 9, 0, 0, 0))
}

/**
 * 区間重複
 * @param {{ start: Date|string, end: Date|string }} a
 * @param {{ start: Date|string, end: Date|string }} b
 */
export function intervalsOverlap(a, b) {
  const aStart = new Date(a.start).getTime()
  const aEnd = new Date(a.end).getTime()
  const bStart = new Date(b.start).getTime()
  const bEnd = new Date(b.end).getTime()
  return aStart < bEnd && aEnd > bStart
}

/**
 * @param {{ start: Date, end: Date }} window
 * @param {Array<{ start: Date|string, end: Date|string }>} occupied
 * @returns {number}
 */
export function countOverlapping(window, occupied) {
  return (occupied || []).filter((o) => intervalsOverlap(window, o)).length
}

/**
 * @typedef {{
 *   now: Date,
 *   desiredPickupAt: Date|null,
 *   orderType: 'NOW'|'SCHEDULED',
 *   unitCount: number,
 *   baseDurationMin: number|null,
 *   occupiedIntervals: Array<{ start: string|Date, end: string|Date }>,
 *   phoneLocks: Array<{ start_at: string|Date, end_at: string|Date }>,
 *   settings: object,
 * }} AvailabilityInput
 */

/**
 * @param {AvailabilityInput} input
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   earliestHint?: string,
 *   usesExtraCapacity: boolean,
 *   perUnitWindows?: Array<{ start: string, end: string }>,
 *   totalDurationMin?: number,
 * }}
 */
export function checkAvailability(input) {
  const now = input.now instanceof Date ? input.now : new Date(input.now)
  const unitCount = Math.max(1, Number(input.unitCount) || 1)
  const totalDurationMin = totalDurationWithBuffer(input.baseDurationMin)

  const nowOutsideHours = input.orderType === 'NOW' && !isPhoneIntakeOpen(now)

  const pickupAt = nowOutsideHours
    ? nextLiffPickupAt(now)
    : input.orderType === 'NOW' || !input.desiredPickupAt
      ? now
      : input.desiredPickupAt instanceof Date
        ? input.desiredPickupAt
        : new Date(input.desiredPickupAt)

  if (Number.isNaN(pickupAt.getTime())) {
    return { ok: false, reason: 'INVALID_PICKUP', usesExtraCapacity: false }
  }

  const window = {
    start: pickupAt,
    end: new Date(pickupAt.getTime() + totalDurationMin * 60 * 1000),
  }

  // 電話優先ロック
  const locks = (input.phoneLocks || []).map((l) => ({
    start: l.start_at ?? l.start,
    end: l.end_at ?? l.end,
  }))
  if (locks.some((l) => intervalsOverlap(window, l))) {
    return { ok: false, reason: 'PHONE_PRIORITY_LOCK', usesExtraCapacity: false }
  }

  const businessDayKey = getLineBusinessDayKey(pickupAt)
  const todayKey = getLineBusinessDayKey(now)
  const isSameBusinessDay = businessDayKey === todayKey

  const cap = resolveCapacityForDay(pickupAt, isSameBusinessDay, input.settings || {})

  const occupied = [
    ...(input.occupiedIntervals || []),
    // LINE ホールドも occupied に含める前提（呼び出し側）
  ]
  const existing = countOverlapping(window, occupied)
  const concurrent = existing + unitCount
  const occupancy = evaluateOccupancy(concurrent, cap)

  if (!occupancy.ok) {
    return {
      ok: false,
      reason: occupancy.reason || 'UNAVAILABLE',
      usesExtraCapacity: false,
      earliestHint: undefined,
      totalDurationMin,
    }
  }

  const perUnitWindows = Array.from({ length: unitCount }, () => ({
    start: window.start.toISOString(),
    end: window.end.toISOString(),
  }))

  if (nowOutsideHours) {
    return {
      ok: false,
      reason: 'REQUIRE_SCHEDULED',
      earliestHint: pickupAt.toISOString(),
      usesExtraCapacity: occupancy.usesExtraCapacity,
      perUnitWindows,
      totalDurationMin,
    }
  }

  return {
    ok: true,
    usesExtraCapacity: occupancy.usesExtraCapacity,
    earliestHint: window.start.toISOString(),
    perUnitWindows,
    totalDurationMin,
  }
}
