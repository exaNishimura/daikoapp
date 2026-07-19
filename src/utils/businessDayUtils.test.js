import { describe, expect, it } from 'vitest'
import {
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
  SALES_CLOSE_HOUR,
  isWithinBusinessHours,
  getBusinessDayBoundaries,
  getActiveWorkDate,
  formatWorkDateKey,
  getMinBusinessDateTime,
  snapDateTimeTo15Minutes,
} from './businessDayUtils'

describe('constants', () => {
  it('uses 18:00 - 06:00 as the business window', () => {
    expect(BUSINESS_START_HOUR).toBe(18)
    expect(BUSINESS_END_HOUR).toBe(6)
  })

  it('uses 08:00 as the sales close hour for active work date', () => {
    expect(SALES_CLOSE_HOUR).toBe(8)
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

describe('getActiveWorkDate', () => {
  it('keeps calendar date during evening business hours', () => {
    const ref = new Date(2025, 5, 1, 23, 30)
    expect(formatWorkDateKey(getActiveWorkDate(ref))).toBe('2025-06-01')
  })

  it('keeps previous work date after midnight until sales close', () => {
    const ref = new Date(2025, 5, 2, 3, 0)
    expect(formatWorkDateKey(getActiveWorkDate(ref))).toBe('2025-06-01')
  })

  it('keeps previous work date at 07:59', () => {
    const ref = new Date(2025, 5, 2, 7, 59)
    expect(formatWorkDateKey(getActiveWorkDate(ref))).toBe('2025-06-01')
  })

  it('switches to calendar date at 08:00', () => {
    const ref = new Date(2025, 5, 2, 8, 0)
    expect(formatWorkDateKey(getActiveWorkDate(ref))).toBe('2025-06-02')
  })

  it('rolls back across month boundary before close', () => {
    const ref = new Date(2025, 6, 1, 2, 0) // 2025-07-01 02:00
    const workDate = getActiveWorkDate(ref)
    expect(formatWorkDateKey(workDate)).toBe('2025-06-30')
    expect(workDate.getFullYear()).toBe(2025)
    expect(workDate.getMonth() + 1).toBe(6)
  })
})

describe('getMinBusinessDateTime', () => {
  it('returns "YYYY-MM-DDT18:00" for the reference date', () => {
    const ref = new Date(2025, 5, 1, 9, 30)
    expect(getMinBusinessDateTime(ref)).toBe('2025-06-01T18:00')
  })
})

describe('snapDateTimeTo15Minutes', () => {
  it('rounds 19:07 down to 19:00', () => {
    expect(snapDateTimeTo15Minutes('2025-06-01T19:07')).toBe('2025-06-01T19:00')
  })

  it('rounds 19:08 up to 19:15', () => {
    expect(snapDateTimeTo15Minutes('2025-06-01T19:08')).toBe('2025-06-01T19:15')
  })

  it('keeps a value already on a 15-minute boundary', () => {
    expect(snapDateTimeTo15Minutes('2025-06-01T20:30')).toBe('2025-06-01T20:30')
  })

  it('rolls forward to the next hour at 19:53', () => {
    expect(snapDateTimeTo15Minutes('2025-06-01T19:53')).toBe('2025-06-01T20:00')
  })

  it('returns falsy values unchanged', () => {
    expect(snapDateTimeTo15Minutes('')).toBe('')
    expect(snapDateTimeTo15Minutes(null)).toBe(null)
    expect(snapDateTimeTo15Minutes(undefined)).toBe(undefined)
  })

  it('returns garbage input unchanged', () => {
    expect(snapDateTimeTo15Minutes('not-a-date')).toBe('not-a-date')
  })
})
