import { describe, expect, it } from 'vitest'
import { formatDateInJst, getCalendarDayRange, getReceptionNightWindow } from './windowUtils.js'

describe('getReceptionNightWindow', () => {
  it('returns [D 19:00, (D+1) 06:00) in Asia/Tokyo as UTC instants', () => {
    const { start, end, startIso, endIso } = getReceptionNightWindow('2026-07-19')

    expect(startIso).toBe('2026-07-19T10:00:00.000Z') // 19:00 JST
    expect(endIso).toBe('2026-07-19T21:00:00.000Z') // 翌06:00 JST
    expect(start.toISOString()).toBe(startIso)
    expect(end.toISOString()).toBe(endIso)
  })

  it('handles month boundary (D=31 → next month 06:00)', () => {
    const { startIso, endIso } = getReceptionNightWindow('2026-07-31')
    expect(startIso).toBe('2026-07-31T10:00:00.000Z')
    expect(endIso).toBe('2026-07-31T21:00:00.000Z') // 8/1 06:00 JST
  })

  it('treats range as half-open: start inclusive, end exclusive', () => {
    const { start, end } = getReceptionNightWindow('2026-07-19')
    const atStart = new Date('2026-07-19T10:00:00.000Z')
    const atEnd = new Date('2026-07-19T21:00:00.000Z')
    const justBeforeEnd = new Date('2026-07-19T20:59:59.999Z')

    expect(atStart.getTime()).toBe(start.getTime())
    expect(atEnd.getTime()).toBe(end.getTime())
    expect(justBeforeEnd.getTime()).toBeLessThan(end.getTime())
  })

  it('throws on invalid date string', () => {
    expect(() => getReceptionNightWindow('2026/07/19')).toThrow()
    expect(() => getReceptionNightWindow('')).toThrow()
  })
})

describe('getCalendarDayRange', () => {
  it('returns [D 00:00, (D+1) 00:00) Asia/Tokyo', () => {
    const { startIso, endIso } = getCalendarDayRange('2026-07-19')
    expect(startIso).toBe('2026-07-18T15:00:00.000Z') // 00:00 JST
    expect(endIso).toBe('2026-07-19T15:00:00.000Z') // 翌00:00 JST
  })

  it('handles year boundary', () => {
    const { startIso, endIso } = getCalendarDayRange('2025-12-31')
    expect(startIso).toBe('2025-12-30T15:00:00.000Z')
    expect(endIso).toBe('2025-12-31T15:00:00.000Z') // 2026-01-01 00:00 JST
  })
})

describe('formatDateInJst', () => {
  it('formats UTC instant as YYYY-MM-DD in Asia/Tokyo', () => {
    // 2026-07-19 00:30 JST = 2026-07-18 15:30 UTC
    expect(formatDateInJst(new Date('2026-07-18T15:30:00.000Z'))).toBe('2026-07-19')
    // 2026-07-19 23:30 JST = 2026-07-19 14:30 UTC
    expect(formatDateInJst(new Date('2026-07-19T14:30:00.000Z'))).toBe('2026-07-19')
  })
})
