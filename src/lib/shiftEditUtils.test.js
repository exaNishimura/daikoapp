import { describe, expect, it } from 'vitest'
import {
  CAR_OPTIONS,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  DOW_MAP,
  TIMELINE_START,
  TIMELINE_END,
  PIXELS_PER_HOUR,
  timeToMinutes,
  minutesToPixels,
  getDaysInMonth,
  getDefaultShiftEditYearMonth,
  resolveSaveScrollTarget,
} from './shiftEditUtils'

describe('constants', () => {
  it('exposes basic options', () => {
    expect(CAR_OPTIONS).toEqual(['1', '2'])
    expect(ROLE_OPTIONS).toEqual(['代行', '随伴'])
    expect(STATUS_OPTIONS).toEqual(['休業', '定休日'])
    expect(DOW_MAP).toEqual(['日', '月', '火', '水', '木', '金', '土'])
    expect(TIMELINE_START).toBe(19)
    expect(TIMELINE_END).toBe(6)
    expect(PIXELS_PER_HOUR).toBe(80)
  })
})

describe('timeToMinutes', () => {
  it('19:00 = 0 minutes', () => {
    expect(timeToMinutes('19:00')).toBe(0)
  })
  it('20:30 = 90', () => {
    expect(timeToMinutes('20:30')).toBe(90)
  })
  it('00:00 = 300', () => {
    expect(timeToMinutes('00:00')).toBe(300)
  })
  it('06:00 = 660', () => {
    expect(timeToMinutes('06:00')).toBe(660)
  })
  it('returns 0 for empty/invalid', () => {
    expect(timeToMinutes('')).toBe(0)
    expect(timeToMinutes(undefined)).toBe(0)
    expect(timeToMinutes('not-a-time')).toBe(0)
  })
})

describe('minutesToPixels', () => {
  it('60 min -> 80px', () => {
    expect(minutesToPixels(60)).toBe(80)
  })
  it('30 min -> 40px', () => {
    expect(minutesToPixels(30)).toBe(40)
  })
  it('660 min -> 880px (whole timeline minus the leading hour)', () => {
    expect(minutesToPixels(660)).toBe(880)
  })
})

describe('getDaysInMonth', () => {
  it('returns 30 entries for 2025-06', () => {
    const days = getDaysInMonth(2025, 6)
    expect(days).toHaveLength(30)
    expect(days[0]).toEqual({ date: '2025-06-01', day: 1, dow: '日', isWeekend: true })
    expect(days[29]).toMatchObject({ date: '2025-06-30', day: 30 })
  })
  it('marks Saturday/Sunday as weekend', () => {
    const days = getDaysInMonth(2025, 6)
    const sat = days.find((d) => d.dow === '土')
    const mon = days.find((d) => d.dow === '月')
    expect(sat.isWeekend).toBe(true)
    expect(mon.isWeekend).toBe(false)
  })
})

describe('getDefaultShiftEditYearMonth', () => {
  it('returns the next month if the reference date is on or after the 20th', () => {
    expect(getDefaultShiftEditYearMonth(new Date(2025, 5, 20))).toEqual({
      year: 2025,
      month: 7,
    })
    expect(getDefaultShiftEditYearMonth(new Date(2025, 11, 31))).toEqual({
      year: 2026,
      month: 1,
    })
  })
  it('returns the current month if the reference date is before the 20th', () => {
    expect(getDefaultShiftEditYearMonth(new Date(2025, 5, 19))).toEqual({
      year: 2025,
      month: 6,
    })
    expect(getDefaultShiftEditYearMonth(new Date(2025, 0, 1))).toEqual({
      year: 2025,
      month: 1,
    })
  })
})

describe('resolveSaveScrollTarget', () => {
  it('prefers the last edited shift date', () => {
    const editingShifts = { a: {}, b: {} }
    const map = { a: '2026-09-03', b: '2026-09-10' }
    expect(resolveSaveScrollTarget(editingShifts, map)).toEqual({
      dates: ['2026-09-03', '2026-09-10'],
      targetDate: '2026-09-10',
    })
  })

  it('falls back to the earliest saved date when last id has no date', () => {
    const editingShifts = { missing: {} }
    const map = { a: '2026-09-05', b: '2026-09-01' }
    expect(resolveSaveScrollTarget(editingShifts, map)).toEqual({
      dates: ['2026-09-01', '2026-09-05'],
      targetDate: '2026-09-01',
    })
  })

  it('returns null target when nothing was saved', () => {
    expect(resolveSaveScrollTarget({}, {})).toEqual({
      dates: [],
      targetDate: null,
    })
  })
})
