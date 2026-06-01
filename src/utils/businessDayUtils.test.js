import { describe, expect, it } from 'vitest'
import {
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
  isWithinBusinessHours,
  getBusinessDayBoundaries,
  getMinBusinessDateTime,
} from './businessDayUtils'

describe('constants', () => {
  it('uses 18:00 - 06:00 as the business window', () => {
    expect(BUSINESS_START_HOUR).toBe(18)
    expect(BUSINESS_END_HOUR).toBe(6)
  })
})

describe('isWithinBusinessHours', () => {
  it('returns true at 18:00', () => {
    expect(isWithinBusinessHours(new Date('2025-06-01T18:00:00'))).toBe(true)
  })

  it('returns true at 23:30', () => {
    expect(isWithinBusinessHours(new Date('2025-06-01T23:30:00'))).toBe(true)
  })

  it('returns true at 02:00 (early morning)', () => {
    expect(isWithinBusinessHours(new Date('2025-06-02T02:00:00'))).toBe(true)
  })

  it('returns false at 06:00 (boundary excluded)', () => {
    expect(isWithinBusinessHours(new Date('2025-06-02T06:00:00'))).toBe(false)
  })

  it('returns false at 12:00', () => {
    expect(isWithinBusinessHours(new Date('2025-06-02T12:00:00'))).toBe(false)
  })

  it('returns false at 17:59', () => {
    expect(isWithinBusinessHours(new Date('2025-06-01T17:59:00'))).toBe(false)
  })

  it('returns false for invalid input', () => {
    expect(isWithinBusinessHours(null)).toBe(false)
    expect(isWithinBusinessHours('not a date')).toBe(false)
  })
})

describe('getBusinessDayBoundaries', () => {
  it('20:00 belongs to today’s business day (start=today 18:00, end=tomorrow 06:00)', () => {
    const ref = new Date(2025, 5, 1, 20, 0) // 2025-06-01 20:00 local
    const { start, end, businessDay } = getBusinessDayBoundaries(ref)
    expect(businessDay.getDate()).toBe(1)
    expect(start.getHours()).toBe(18)
    expect(start.getDate()).toBe(1)
    expect(end.getHours()).toBe(6)
    expect(end.getDate()).toBe(2)
  })

  it('03:00 belongs to PREVIOUS day’s business day', () => {
    const ref = new Date(2025, 5, 2, 3, 0) // 2025-06-02 03:00 local
    const { start, end, businessDay } = getBusinessDayBoundaries(ref)
    expect(businessDay.getDate()).toBe(1)
    expect(start.getDate()).toBe(1)
    expect(end.getDate()).toBe(2)
  })

  it('06:00 belongs to TODAY’s business day (boundary inclusive on the start side)', () => {
    const ref = new Date(2025, 5, 2, 6, 0)
    const { businessDay } = getBusinessDayBoundaries(ref)
    expect(businessDay.getDate()).toBe(2)
  })

  it('12:00 (off-hours) treats today as business day so the next 18:00 starts the window', () => {
    const ref = new Date(2025, 5, 2, 12, 0)
    const { start, businessDay } = getBusinessDayBoundaries(ref)
    expect(businessDay.getDate()).toBe(2)
    expect(start.getHours()).toBe(18)
    expect(start.getDate()).toBe(2)
  })
})

describe('getMinBusinessDateTime', () => {
  it('returns "YYYY-MM-DDT18:00" for the reference date', () => {
    const ref = new Date(2025, 5, 1, 9, 30)
    expect(getMinBusinessDateTime(ref)).toBe('2025-06-01T18:00')
  })
})
