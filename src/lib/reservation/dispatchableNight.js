import { combineOvernightPickup } from '@/utils/liffPickupTime'
import { getOperationalVehicles } from '@/utils/operationStatusUtils'
import { buildOperationStatusesFromShifts } from '@/utils/shiftOperationUtils'
import {
  RESERVATION_HOURS,
  RESERVATION_MINUTES,
  formatReservationHourLabel,
  formatReservationMinuteLabel,
} from './reservationTime'

export function carNumberFromVehicleName(name) {
  return String(name || '')
    .replace('号車', '')
    .trim()
}

export function isNightHoliday(shiftsByCar) {
  const all = Object.values(shiftsByCar || {}).flat()
  return all.some((shift) => !shift.car && (shift.status === '休業' || shift.status === '定休日'))
}

/**
 * その夜の号車ごとの稼働状況。
 * 保存済み operation_status があればそれを優先。なければシフトから DAY_OFF+START を組み立てる。
 */
export function resolveNightOperationStatuses({
  vehicles = [],
  storedByVehicleId = {},
  shiftsByCar = {},
  dateStr,
} = {}) {
  const holiday = isNightHoliday(shiftsByCar)
  const result = {}

  for (const vehicle of vehicles) {
    if (!vehicle?.id) continue
    const stored = storedByVehicleId[vehicle.id]
    if (Array.isArray(stored) && stored.length > 0) {
      result[vehicle.id] = stored
      continue
    }

    if (holiday) {
      result[vehicle.id] = [{ vehicle_id: vehicle.id, date: dateStr, type: 'DAY_OFF', time: null }]
      continue
    }

    const vehicleShifts = shiftsByCar[carNumberFromVehicleName(vehicle.name)] || []
    result[vehicle.id] = buildOperationStatusesFromShifts(vehicleShifts).map((status) => ({
      ...status,
      vehicle_id: vehicle.id,
      date: dateStr,
    }))
  }

  return result
}

function isGrandfathered(allowSlot, nightDate, hour, minute) {
  if (!allowSlot || allowSlot.date !== nightDate) return false
  return Number(allowSlot.hour) === Number(hour) && Number(allowSlot.minute) === Number(minute)
}

/**
 * その夜の 15 分枠が配車可能か。
 * @returns {Array<{ hour: number, minute: number, available: boolean, past: boolean, operational: boolean }>}
 */
export function buildDispatchableSlots({
  nightDate,
  vehicles = [],
  statusesMap = {},
  now = new Date(),
  allowSlot = null,
} = {}) {
  if (!nightDate) return []

  const slots = []
  for (const hour of RESERVATION_HOURS) {
    for (const minute of RESERVATION_MINUTES) {
      const at = combineOvernightPickup(nightDate, hour, minute)
      if (!at) continue
      const past = at.getTime() <= now.getTime()
      const operational = getOperationalVehicles(vehicles, at, statusesMap).length > 0
      const grandfathered = isGrandfathered(allowSlot, nightDate, hour, minute)
      slots.push({
        hour,
        minute,
        past,
        operational,
        available: grandfathered || (!past && operational),
      })
    }
  }
  return slots
}

export function hourHasDispatchable(slots, hour) {
  if (!slots?.length) return true
  return slots.some((slot) => slot.hour === hour && slot.available)
}

export function isSlotDispatchable(slots, hour, minute) {
  if (!slots?.length) return true
  return slots.some((slot) => slot.hour === hour && slot.minute === minute && slot.available)
}

export function firstDispatchableSlot(slots) {
  return (slots || []).find((slot) => slot.available) || null
}

export function formatDispatchableHourLabel(hour, slots) {
  const base = formatReservationHourLabel(hour)
  const mins = (slots || []).filter((slot) => slot.hour === hour)
  if (!mins.length) return base
  if (mins.some((slot) => slot.available)) return base
  if (mins.every((slot) => slot.past)) return `${base}（終了）`
  return `${base}（稼働時間外）`
}

export function formatDispatchableMinuteLabel(slot) {
  const base = formatReservationMinuteLabel(slot.minute)
  if (slot.available) return base
  if (slot.past) return `${base}（終了）`
  return `${base}（稼働時間外）`
}

export function formatDispatchableWindowLabel(slots) {
  const open = (slots || []).filter((slot) => slot.available)
  if (!open.length) return ''
  const fmt = (slot) => `${slot.hour}:${String(slot.minute).padStart(2, '0')}`
  return `この夜の配車可能: ${fmt(open[0])}〜${fmt(open[open.length - 1])}`
}
