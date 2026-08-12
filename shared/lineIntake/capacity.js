/**
 * 稼働台数・仮想余裕枠（実車両マスタは増減しない）
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * @typedef {{
 *   weekday_fleet_count: number,
 *   weekend_fleet_count: number,
 *   max_fleet_count: number,
 *   extra_capacity_max: number,
 *   phone_intake_start_hour?: number,
 * }} FleetSettings
 */

export const DEFAULT_FLEET_SETTINGS = Object.freeze({
  phone_intake_start_hour: 19,
  weekday_fleet_count: 1,
  weekend_fleet_count: 2,
  max_fleet_count: 3,
  extra_capacity_max: 2,
})

/**
 * @param {Date} date
 * @returns {number} 0=Sun .. 6=Sat (JST)
 */
export function getJstWeekday(date) {
  const jst = new Date(date.getTime() + JST_OFFSET_MS)
  return jst.getUTCDay()
}

/**
 * 金土 = weekend_fleet_count、それ以外 = weekday
 * @param {Date|string} businessDayDate
 * @param {Partial<FleetSettings>} settings
 * @returns {number}
 */
export function getOperatingFleetCount(businessDayDate, settings = {}) {
  const cfg = { ...DEFAULT_FLEET_SETTINGS, ...settings }
  const date = businessDayDate instanceof Date ? businessDayDate : new Date(businessDayDate)
  const weekday = getJstWeekday(date)
  const isWeekend = weekday === 5 || weekday === 6 // Fri / Sat
  const count = isWeekend ? cfg.weekend_fleet_count : cfg.weekday_fleet_count
  return Math.min(Math.max(1, count), cfg.max_fleet_count)
}

/**
 * @param {Date|string} businessDay
 * @param {boolean} isSameBusinessDay
 * @param {Partial<FleetSettings>} settings
 */
export function resolveCapacityForDay(businessDay, isSameBusinessDay, settings = {}) {
  const cfg = { ...DEFAULT_FLEET_SETTINGS, ...settings }
  const fleetCount = getOperatingFleetCount(businessDay, cfg)
  const configuredExtra = Math.max(0, Number(cfg.extra_capacity_max) || 0)
  const extraAllowed = isSameBusinessDay ? 0 : Math.min(configuredExtra, 2)
  return {
    fleetCount,
    extraAllowed,
    capacity: fleetCount + extraAllowed,
  }
}

/**
 * 同時占用が fleet を超えるか
 * @param {number} concurrentCount 既存 + 今回の台数込み
 * @param {{ fleetCount: number, capacity: number }} cap
 * @returns {{ ok: boolean, usesExtraCapacity: boolean, reason?: string }}
 */
export function evaluateOccupancy(concurrentCount, cap) {
  if (concurrentCount > cap.capacity) {
    return { ok: false, usesExtraCapacity: false, reason: 'CAPACITY_FULL' }
  }
  const usesExtraCapacity = concurrentCount > cap.fleetCount
  return { ok: true, usesExtraCapacity }
}
