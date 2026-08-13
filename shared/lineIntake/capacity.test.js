import { describe, expect, it } from 'vitest'
import { evaluateOccupancy, getOperatingFleetCount, resolveCapacityForDay } from './capacity.js'

describe('getOperatingFleetCount', () => {
  it('weekday = 1, Fri/Sat = 2 by default', () => {
    // 2026-08-11 Tue
    expect(getOperatingFleetCount(new Date('2026-08-11T00:00:00.000Z'))).toBe(1)
    // 2026-08-14 Fri
    expect(getOperatingFleetCount(new Date('2026-08-14T00:00:00.000Z'))).toBe(2)
    // 2026-08-15 Sat
    expect(getOperatingFleetCount(new Date('2026-08-15T00:00:00.000Z'))).toBe(2)
  })
})

describe('resolveCapacityForDay', () => {
  it('same-day has no extra', () => {
    const cap = resolveCapacityForDay(new Date('2026-08-11T00:00:00.000Z'), true)
    expect(cap.fleetCount).toBe(1)
    expect(cap.extraAllowed).toBe(0)
    expect(cap.capacity).toBe(1)
  })

  it('advance booking allows configured extra up to 2', () => {
    const cap = resolveCapacityForDay(new Date('2026-08-11T00:00:00.000Z'), false, {
      extra_capacity_max: 2,
    })
    expect(cap.capacity).toBe(3)
    expect(cap.extraAllowed).toBe(2)
  })
})

describe('evaluateOccupancy', () => {
  it('flags usesExtraCapacity when over fleet but within capacity', () => {
    const r = evaluateOccupancy(2, { fleetCount: 1, capacity: 3 })
    expect(r.ok).toBe(true)
    expect(r.usesExtraCapacity).toBe(true)
  })

  it('rejects over capacity', () => {
    const r = evaluateOccupancy(4, { fleetCount: 1, capacity: 3 })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('CAPACITY_FULL')
  })
})
