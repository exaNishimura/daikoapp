import { describe, expect, it } from 'vitest'
import {
  checkAvailability,
  getLineBusinessDayKey,
  intervalsOverlap,
  nextLiffPickupAt,
} from './availability.js'

describe('getLineBusinessDayKey', () => {
  it('rolls back before 06:00 JST', () => {
    // 2026-08-12 05:00 JST = 2026-08-11T20:00Z → business day 08-11
    expect(getLineBusinessDayKey(new Date('2026-08-11T20:00:00.000Z'))).toBe('2026-08-11')
    // 2026-08-11 19:00 JST
    expect(getLineBusinessDayKey(new Date('2026-08-11T10:00:00.000Z'))).toBe('2026-08-11')
  })
})

describe('intervalsOverlap', () => {
  it('detects overlap', () => {
    expect(
      intervalsOverlap(
        { start: '2026-08-11T10:00:00.000Z', end: '2026-08-11T11:00:00.000Z' },
        { start: '2026-08-11T10:30:00.000Z', end: '2026-08-11T12:00:00.000Z' }
      )
    ).toBe(true)
    expect(
      intervalsOverlap(
        { start: '2026-08-11T10:00:00.000Z', end: '2026-08-11T11:00:00.000Z' },
        { start: '2026-08-11T11:00:00.000Z', end: '2026-08-11T12:00:00.000Z' }
      )
    ).toBe(false)
  })
})

describe('checkAvailability', () => {
  it('rejects NOW outside phone intake hours but still hints next 20:00', () => {
    const result = checkAvailability({
      now: new Date('2026-08-11T05:00:00.000Z'), // 14:00 JST
      orderType: 'NOW',
      unitCount: 1,
      baseDurationMin: 20,
      occupiedIntervals: [],
      phoneLocks: [],
      settings: {},
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('REQUIRE_SCHEDULED')
    expect(result.earliestHint).toBe('2026-08-11T11:00:00.000Z') // 20:00 JST
  })

  it('nextLiffPickupAt is today 20:00 JST during daytime', () => {
    expect(nextLiffPickupAt(new Date('2026-08-11T05:00:00.000Z')).toISOString()).toBe(
      '2026-08-11T11:00:00.000Z'
    )
  })

  it('rejects when phone priority lock overlaps', () => {
    const pickup = new Date('2026-08-12T10:00:00.000Z') // next day 19:00
    const result = checkAvailability({
      now: new Date('2026-08-11T05:00:00.000Z'),
      desiredPickupAt: pickup,
      orderType: 'SCHEDULED',
      unitCount: 1,
      baseDurationMin: 20,
      occupiedIntervals: [],
      phoneLocks: [
        {
          start_at: '2026-08-12T10:00:00.000Z',
          end_at: '2026-08-12T11:00:00.000Z',
        },
      ],
      settings: {},
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('PHONE_PRIORITY_LOCK')
  })

  it('same-day has no extra capacity', () => {
    const now = new Date('2026-08-11T10:00:00.000Z') // 19:00 JST Tue
    const result = checkAvailability({
      now,
      desiredPickupAt: now,
      orderType: 'SCHEDULED',
      unitCount: 1,
      baseDurationMin: 20,
      occupiedIntervals: [
        {
          start: '2026-08-11T10:00:00.000Z',
          end: '2026-08-11T10:30:00.000Z',
        },
      ],
      phoneLocks: [],
      settings: { weekday_fleet_count: 1, extra_capacity_max: 2 },
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('CAPACITY_FULL')
  })

  it('advance booking can use extra and flag 要手配', () => {
    const now = new Date('2026-08-11T05:00:00.000Z')
    const pickup = new Date('2026-08-14T10:00:00.000Z') // Fri
    const result = checkAvailability({
      now,
      desiredPickupAt: pickup,
      orderType: 'SCHEDULED',
      unitCount: 1,
      baseDurationMin: 20,
      occupiedIntervals: [
        { start: '2026-08-14T10:00:00.000Z', end: '2026-08-14T10:30:00.000Z' },
        { start: '2026-08-14T10:05:00.000Z', end: '2026-08-14T10:35:00.000Z' },
      ],
      phoneLocks: [],
      settings: {
        weekend_fleet_count: 2,
        extra_capacity_max: 2,
      },
    })
    // fleet=2, occupied=2, +1 = 3 → uses extra
    expect(result.ok).toBe(true)
    expect(result.usesExtraCapacity).toBe(true)
  })

  it('phone lock wins over holding occupancy (caller merges locks)', () => {
    const pickup = new Date('2026-08-12T10:00:00.000Z')
    const result = checkAvailability({
      now: new Date('2026-08-11T05:00:00.000Z'),
      desiredPickupAt: pickup,
      orderType: 'SCHEDULED',
      unitCount: 1,
      baseDurationMin: 20,
      occupiedIntervals: [],
      phoneLocks: [
        { start_at: pickup.toISOString(), end_at: new Date(pickup.getTime() + 600000).toISOString() },
      ],
      settings: {},
    })
    expect(result.reason).toBe('PHONE_PRIORITY_LOCK')
  })
})
