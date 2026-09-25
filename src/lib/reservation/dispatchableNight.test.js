import { describe, expect, it } from 'vitest'
import {
  buildDispatchableSlots,
  carNumberFromVehicleName,
  firstDispatchableSlot,
  formatDispatchableHourLabel,
  hourHasDispatchable,
  isNightHoliday,
  isSlotDispatchable,
  resolveNightOperationStatuses,
} from './dispatchableNight'

const V1 = { id: 'v1', name: '1号車' }
const V2 = { id: 'v2', name: '2号車' }

describe('carNumberFromVehicleName', () => {
  it('strips 号車', () => {
    expect(carNumberFromVehicleName('1号車')).toBe('1')
  })
})

describe('isNightHoliday', () => {
  it('detects 休業 rows without a car', () => {
    expect(isNightHoliday({ '': [{ car: null, status: '休業' }] })).toBe(true)
  })

  it('ignores normal shifts', () => {
    expect(isNightHoliday({ 1: [{ car: '1', start: '20:00' }] })).toBe(false)
  })
})

describe('resolveNightOperationStatuses', () => {
  it('prefers stored operation status', () => {
    const stored = {
      v1: [{ vehicle_id: 'v1', date: '2026-09-25', type: 'DEFAULT', time: null }],
    }
    const resolved = resolveNightOperationStatuses({
      vehicles: [V1],
      storedByVehicleId: stored,
      shiftsByCar: { 1: [] },
      dateStr: '2026-09-25',
    })
    expect(resolved.v1[0].type).toBe('DEFAULT')
  })

  it('builds DAY_OFF + START from shifts when stored is empty', () => {
    const resolved = resolveNightOperationStatuses({
      vehicles: [V1],
      storedByVehicleId: {},
      shiftsByCar: { 1: [{ car: '1', start: '20:00', end: '02:00' }] },
      dateStr: '2026-09-25',
    })
    expect(resolved.v1).toEqual([
      { type: 'DAY_OFF', time: null, vehicle_id: 'v1', date: '2026-09-25' },
      { type: 'START', time: '20:00', vehicle_id: 'v1', date: '2026-09-25' },
    ])
  })

  it('marks DAY_OFF when the vehicle has no shift', () => {
    const resolved = resolveNightOperationStatuses({
      vehicles: [V1],
      storedByVehicleId: {},
      shiftsByCar: {},
      dateStr: '2026-09-25',
    })
    expect(resolved.v1.map((s) => s.type)).toEqual(['DAY_OFF'])
  })
})

describe('buildDispatchableSlots', () => {
  const nightDate = '2026-09-25'
  const now = new Date(2026, 8, 25, 16, 0, 0, 0)

  it('disables 18:00 when the only vehicle starts at 20:00', () => {
    const statusesMap = resolveNightOperationStatuses({
      vehicles: [V1],
      shiftsByCar: { 1: [{ car: '1', start: '20:00' }] },
      dateStr: nightDate,
    })
    const slots = buildDispatchableSlots({
      nightDate,
      vehicles: [V1],
      statusesMap,
      now,
    })
    expect(isSlotDispatchable(slots, 18, 0)).toBe(false)
    expect(isSlotDispatchable(slots, 19, 45)).toBe(false)
    expect(isSlotDispatchable(slots, 20, 0)).toBe(true)
    expect(isSlotDispatchable(slots, 2, 0)).toBe(true)
    expect(hourHasDispatchable(slots, 18)).toBe(false)
    expect(hourHasDispatchable(slots, 20)).toBe(true)
    expect(firstDispatchableSlot(slots)).toEqual(
      expect.objectContaining({ hour: 20, minute: 0, available: true })
    )
  })

  it('keeps 18:00 when another vehicle is already on', () => {
    const statusesMap = resolveNightOperationStatuses({
      vehicles: [V1, V2],
      shiftsByCar: {
        1: [{ car: '1', start: '20:00' }],
        2: [{ car: '2', start: '18:00' }],
      },
      dateStr: nightDate,
    })
    const slots = buildDispatchableSlots({
      nightDate,
      vehicles: [V1, V2],
      statusesMap,
      now,
    })
    expect(isSlotDispatchable(slots, 18, 0)).toBe(true)
    expect(isSlotDispatchable(slots, 20, 0)).toBe(true)
  })

  it('has no slots when every vehicle is DAY_OFF', () => {
    const statusesMap = {
      v1: [{ vehicle_id: 'v1', date: nightDate, type: 'DAY_OFF', time: null }],
    }
    const slots = buildDispatchableSlots({
      nightDate,
      vehicles: [V1],
      statusesMap,
      now,
    })
    expect(slots.every((slot) => !slot.available)).toBe(true)
    expect(firstDispatchableSlot(slots)).toBe(null)
  })

  it('marks already-passed slots on the current night unavailable', () => {
    const statusesMap = resolveNightOperationStatuses({
      vehicles: [V1],
      shiftsByCar: { 1: [{ car: '1', start: '18:00' }] },
      dateStr: nightDate,
    })
    const slots = buildDispatchableSlots({
      nightDate,
      vehicles: [V1],
      statusesMap,
      now: new Date(2026, 8, 25, 21, 10, 0, 0),
    })
    expect(isSlotDispatchable(slots, 20, 0)).toBe(false)
    expect(isSlotDispatchable(slots, 21, 15)).toBe(true)
  })

  it('keeps an existing reservation slot even if it is now in the past', () => {
    const statusesMap = resolveNightOperationStatuses({
      vehicles: [V1],
      shiftsByCar: { 1: [{ car: '1', start: '18:00' }] },
      dateStr: nightDate,
    })
    const slots = buildDispatchableSlots({
      nightDate,
      vehicles: [V1],
      statusesMap,
      now: new Date(2026, 8, 25, 21, 10, 0, 0),
      allowSlot: { date: nightDate, hour: 20, minute: 0 },
    })
    expect(isSlotDispatchable(slots, 20, 0)).toBe(true)
    expect(isSlotDispatchable(slots, 20, 15)).toBe(false)
  })
})

describe('formatDispatchableHourLabel', () => {
  it('annotates hours with no operational vehicles', () => {
    expect(
      formatDispatchableHourLabel(18, [
        { hour: 18, minute: 0, available: false, past: false },
        { hour: 18, minute: 15, available: false, past: false },
      ])
    ).toBe('18時（稼働時間外）')
  })
})
