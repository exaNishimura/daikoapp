import {
  LIFF_PICKUP_HOURS,
  LIFF_PICKUP_MINUTES,
  combineOvernightPickup,
  formatLiffHourLabel,
  formatLiffMinuteLabel,
  getMinLiffPickupDate,
} from '@/utils/liffPickupTime'

const DEFAULT_BASE_MIN = 20
const RESERVATION_FALLBACK_MIN = 30

function intervalsOverlap(a, b) {
  return (
    new Date(a.start).getTime() < new Date(b.end).getTime() &&
    new Date(a.end).getTime() > new Date(b.start).getTime()
  )
}

function countOverlapping(window, occupied) {
  return (occupied || []).filter((o) => intervalsOverlap(window, o)).length
}

function lineBufferMin(baseDurationMin) {
  const base =
    Number.isFinite(Number(baseDurationMin)) && Number(baseDurationMin) > 0
      ? Number(baseDurationMin)
      : DEFAULT_BASE_MIN
  return Math.max(5, Math.ceil(base * 0.15)) + 5
}

function totalWindowMin(baseDurationMin) {
  const base =
    Number.isFinite(Number(baseDurationMin)) && Number(baseDurationMin) > 0
      ? Number(baseDurationMin)
      : DEFAULT_BASE_MIN
  return base + lineBufferMin(base)
}

/**
 * 配車スロット・予約台帳・LINE仮受付から占用区間を作る（Edge の loadOccupiedIntervals と同じ規則）
 */
export function occupiedFromSources({ units = [], slots = [], reservations = [] } = {}) {
  const occupied = []
  for (const u of units) {
    const dur =
      (u.base_duration_min || DEFAULT_BASE_MIN) +
      (u.buffer_min ?? lineBufferMin(u.base_duration_min))
    const start = new Date(u.pickup_at)
    occupied.push({ start, end: new Date(start.getTime() + dur * 60 * 1000) })
  }
  for (const s of slots) {
    occupied.push({ start: s.start_at, end: s.end_at })
  }
  for (const r of reservations) {
    const start = new Date(r.reserved_at)
    occupied.push({ start, end: new Date(start.getTime() + RESERVATION_FALLBACK_MIN * 60 * 1000) })
  }
  return occupied
}

function nightCapacity(nightDate, now, settings = {}) {
  const nightStart = combineOvernightPickup(nightDate, 20, 0)
  if (!nightStart) return 1
  const weekday = nightStart.getDay()
  const isWeekend = weekday === 5 || weekday === 6
  const fleet = Math.min(
    Math.max(
      1,
      isWeekend ? (settings.weekend_fleet_count ?? 2) : (settings.weekday_fleet_count ?? 1)
    ),
    settings.max_fleet_count ?? 3
  )
  const extraMax = Math.min(Math.max(0, Number(settings.extra_capacity_max) || 2), 2)
  const sameBusinessDay = nightDate === getMinLiffPickupDate(now)
  return fleet + (sameBusinessDay ? 0 : extraMax)
}

/**
 * その夜の 15 分枠ごとの空き / 予約済み / 終了
 * @returns {Array<{ hour: number, minute: number, available: boolean, booked: boolean, past: boolean }>}
 */
export function buildLiffNightSlots({
  nightDate,
  now = new Date(),
  occupiedIntervals = [],
  phoneLocks = [],
  settings = {},
  unitCount = 1,
} = {}) {
  if (!nightDate) return []
  const capacity = nightCapacity(nightDate, now, settings)
  const windowMin = totalWindowMin(DEFAULT_BASE_MIN)
  const count = Math.max(1, Number(unitCount) || 1)
  const locks = (phoneLocks || []).map((l) => ({
    start: l.start_at ?? l.start,
    end: l.end_at ?? l.end,
  }))

  const slots = []
  for (const hour of LIFF_PICKUP_HOURS) {
    for (const minute of LIFF_PICKUP_MINUTES) {
      const pickupAt = combineOvernightPickup(nightDate, hour, minute)
      if (!pickupAt) continue
      const past = pickupAt.getTime() <= now.getTime()
      const window = {
        start: pickupAt,
        end: new Date(pickupAt.getTime() + windowMin * 60 * 1000),
      }
      const locked = locks.some((l) => intervalsOverlap(window, l))
      const overlapping = countOverlapping(window, occupiedIntervals)
      const booked = locked || overlapping + count > capacity
      slots.push({
        hour,
        minute,
        past,
        booked: !past && booked,
        available: !past && !booked,
      })
    }
  }
  return slots
}

export function firstAvailableSlot(slots) {
  return (slots || []).find((s) => s.available) || null
}

export function hourHasAvailable(slots, hour) {
  if (!slots?.length) return true
  return slots.some((s) => s.hour === hour && s.available)
}

export function formatLiffHourOptionLabel(hour, slots) {
  const base = formatLiffHourLabel(hour)
  const mins = (slots || []).filter((s) => s.hour === hour)
  if (!mins.length) return base
  if (mins.some((s) => s.available)) return base
  if (mins.every((s) => s.past)) return `${base}（終了）`
  if (mins.some((s) => s.booked)) return `${base}（予約済み）`
  return base
}

export function formatLiffMinuteOptionLabel(slot) {
  const base = formatLiffMinuteLabel(slot.minute)
  if (slot.past) return `${base}（終了）`
  if (slot.booked) return `${base}（予約済み）`
  return base
}
