import { describe, expect, it } from 'vitest'
import {
  parseAmount,
  parseKm,
  parseHours,
  parseDay,
  parseJpDate,
  parsePeriodFromFileName,
} from './value-parsers'

describe('parseAmount', () => {
  it('parses ¥-prefixed integers', () => {
    expect(parseAmount('¥41,000')).toBe(41000)
    expect(parseAmount('¥3,000')).toBe(3000)
  })

  it('strips trailing dash decoration but preserves leading minus', () => {
    expect(parseAmount('¥27,000-')).toBe(27000)
    expect(parseAmount('¥-6,400')).toBe(-6400)
  })

  it('accepts plain numbers', () => {
    expect(parseAmount(2500)).toBe(2500)
    expect(parseAmount('2000')).toBe(2000)
  })

  it('returns null for empty / invalid', () => {
    expect(parseAmount(null)).toBeNull()
    expect(parseAmount(undefined)).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
    expect(parseAmount('¥')).toBeNull()
    expect(parseAmount('-')).toBeNull()
    expect(parseAmount('foo')).toBeNull()
  })

  it('truncates fractional input', () => {
    expect(parseAmount(123.7)).toBe(123)
  })
})

describe('parseKm', () => {
  it('extracts km values', () => {
    expect(parseKm('175km')).toBe(175)
    expect(parseKm('143km')).toBe(143)
    expect(parseKm('4,060km')).toBe(4060)
  })

  it('accepts numbers and uppercase', () => {
    expect(parseKm(112)).toBe(112)
    expect(parseKm('112KM')).toBe(112)
  })

  it('returns null for empty', () => {
    expect(parseKm('')).toBeNull()
    expect(parseKm(null)).toBeNull()
    expect(parseKm('km')).toBeNull()
  })
})

describe('parseHours', () => {
  it('extracts hour values', () => {
    expect(parseHours('9.50h')).toBe(9.5)
    expect(parseHours('19.00h')).toBe(19)
    expect(parseHours('0.00h')).toBe(0)
  })

  it('accepts numbers', () => {
    expect(parseHours(7.5)).toBe(7.5)
  })

  it('returns null for empty', () => {
    expect(parseHours('')).toBeNull()
    expect(parseHours(null)).toBeNull()
    expect(parseHours('h')).toBeNull()
  })
})

describe('parseDay', () => {
  it('extracts day-of-month from "5日" notation', () => {
    expect(parseDay('5日')).toBe(5)
    expect(parseDay('31日')).toBe(31)
    expect(parseDay('1日')).toBe(1)
  })

  it('accepts plain numbers in 1-31 range', () => {
    expect(parseDay(15)).toBe(15)
    expect(parseDay('15')).toBe(15)
  })

  it('rejects clearly invalid numbers (zero / negative)', () => {
    expect(parseDay(0)).toBeNull()
    expect(parseDay('-1')).toBeNull()
    // Numbers outside 1-31 are interpreted as Excel serials, not rejected.
    // (See "treats out-of-range numbers as Excel date serials" below.)
  })

  it('returns null for invalid', () => {
    expect(parseDay('')).toBeNull()
    expect(parseDay(null)).toBeNull()
    expect(parseDay('foo')).toBeNull()
  })

  it('extracts day from a Date object', () => {
    expect(parseDay(new Date(2026, 4, 15))).toBe(15)
    expect(parseDay(new Date(2026, 4, 1))).toBe(1)
  })

  it('treats out-of-range numbers as Excel date serials', () => {
    // Excel serial 46086 = 2026-05-05
    expect(parseDay(46086)).toBe(5)
    // Excel serial 46157 = 2026-07-15
    expect(parseDay(46157)).toBe(15)
  })
})

describe('parseJpDate', () => {
  it('parses "YYYY年M月D日"', () => {
    const d = parseJpDate('2026年5月31日')
    expect(d).toBeInstanceOf(Date)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // May
    expect(d.getDate()).toBe(31)
  })

  it('parses zero-padded form', () => {
    const d = parseJpDate('2026年05月08日')
    expect(d.getMonth()).toBe(4)
    expect(d.getDate()).toBe(8)
  })

  it('parses ISO-ish forms', () => {
    expect(parseJpDate('2026/5/31').getDate()).toBe(31)
    expect(parseJpDate('2026-5-31').getDate()).toBe(31)
  })

  it('passes Date through', () => {
    const src = new Date(2026, 4, 31)
    expect(parseJpDate(src)).toBe(src)
  })

  it('returns null for invalid dates', () => {
    expect(parseJpDate('2026年13月1日')).toBeNull()
    expect(parseJpDate('2026年2月30日')).toBeNull() // 自動繰り上がりを拒否
    expect(parseJpDate('')).toBeNull()
    expect(parseJpDate(null)).toBeNull()
  })
})

describe('parsePeriodFromFileName', () => {
  it('extracts year/month from canonical filename', () => {
    expect(parsePeriodFromFileName('202605稼働管理表new.xlsx')).toEqual({
      year: 2026,
      month: 5,
    })
    expect(parsePeriodFromFileName('202412稼働管理表.xlsx')).toEqual({
      year: 2024,
      month: 12,
    })
  })

  it('returns null for non-matching names', () => {
    expect(parsePeriodFromFileName('202605売上.xlsx')).toBeNull()
    expect(parsePeriodFromFileName('稼働管理表.xlsx')).toBeNull()
    expect(parsePeriodFromFileName('')).toBeNull()
    expect(parsePeriodFromFileName(null)).toBeNull()
  })

  it('rejects out-of-range months', () => {
    expect(parsePeriodFromFileName('202613稼働管理表.xlsx')).toBeNull()
    expect(parsePeriodFromFileName('202600稼働管理表.xlsx')).toBeNull()
  })
})
