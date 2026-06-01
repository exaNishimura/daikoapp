import { describe, expect, it } from 'vitest'
import {
  formatYen,
  formatYenWithDash,
  formatJpDatePadded,
  formatJpDate,
  formatLineNumber,
  monthStart,
  monthEnd,
} from './formatters'

describe('formatYen', () => {
  it('formats integers with commas and ¥ prefix', () => {
    expect(formatYen(3000)).toBe('¥3,000')
    expect(formatYen(27000)).toBe('¥27,000')
    expect(formatYen(826500)).toBe('¥826,500')
    expect(formatYen(0)).toBe('¥0')
  })

  it('handles negatives', () => {
    expect(formatYen(-6400)).toBe('-¥6,400')
  })

  it('returns empty for null/undefined/NaN', () => {
    expect(formatYen(null)).toBe('')
    expect(formatYen(undefined)).toBe('')
    expect(formatYen(NaN)).toBe('')
  })
})

describe('formatYenWithDash', () => {
  it('appends "- " for invoice total', () => {
    expect(formatYenWithDash(27000)).toBe('¥27,000- ')
    expect(formatYenWithDash(3000)).toBe('¥3,000- ')
  })

  it('returns empty for null', () => {
    expect(formatYenWithDash(null)).toBe('')
  })
})

describe('formatJpDatePadded', () => {
  it('zero-pads month and day', () => {
    expect(formatJpDatePadded(new Date(2026, 4, 8))).toBe('2026年05月08日')
    expect(formatJpDatePadded(new Date(2026, 11, 31))).toBe('2026年12月31日')
  })

  it('returns empty for invalid', () => {
    expect(formatJpDatePadded(null)).toBe('')
    expect(formatJpDatePadded(new Date('invalid'))).toBe('')
  })
})

describe('formatJpDate', () => {
  it('does not zero-pad', () => {
    expect(formatJpDate(new Date(2026, 4, 31))).toBe('2026年5月31日')
    expect(formatJpDate(new Date(2026, 0, 1))).toBe('2026年1月1日')
  })
})

describe('formatLineNumber', () => {
  it('appends a half-width space', () => {
    expect(formatLineNumber(1)).toBe('1 ')
    expect(formatLineNumber(18)).toBe('18 ')
  })
})

describe('monthStart / monthEnd', () => {
  it('returns first day of given month', () => {
    expect(monthStart(2026, 5)).toEqual(new Date(2026, 4, 1))
  })

  it('returns last day of given month', () => {
    expect(monthEnd(2026, 5)).toEqual(new Date(2026, 4, 31))
    expect(monthEnd(2026, 2)).toEqual(new Date(2026, 1, 28)) // 2026 not a leap year
    expect(monthEnd(2024, 2)).toEqual(new Date(2024, 1, 29)) // 2024 leap
  })
})
