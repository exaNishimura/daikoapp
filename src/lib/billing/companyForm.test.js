import { describe, expect, it } from 'vitest'
import {
  normalizeAlias,
  normalizeAliases,
  validateCompanyForm,
} from './companyForm'

describe('normalizeAlias', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalizeAlias('  鈴友  ')).toBe('鈴友')
  })

  it('converts full-width ASCII to half-width', () => {
    expect(normalizeAlias('ＡＢＣ１２３')).toBe('ABC123')
  })

  it('converts full-width space to half-width', () => {
    expect(normalizeAlias('株式会社 鈴友')).toBe('株式会社 鈴友')
    expect(normalizeAlias('株式会社\u3000鈴友')).toBe('株式会社 鈴友')
  })

  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeAlias(null)).toBe('')
    expect(normalizeAlias(undefined)).toBe('')
    expect(normalizeAlias('')).toBe('')
  })

  it('keeps regular Japanese characters intact', () => {
    expect(normalizeAlias('鈴友')).toBe('鈴友')
  })
})

describe('normalizeAliases', () => {
  it('normalizes, dedupes, and removes empty entries', () => {
    const result = normalizeAliases(['鈴友', '  鈴友  ', '', null, '(株)鈴友', 'ＡＢＣ'])
    expect(result).toEqual(['鈴友', '(株)鈴友', 'ABC'])
  })

  it('returns empty array for non-array input', () => {
    expect(normalizeAliases(null)).toEqual([])
    expect(normalizeAliases(undefined)).toEqual([])
    expect(normalizeAliases('not-an-array')).toEqual([])
  })

  it('preserves order of first occurrence', () => {
    expect(normalizeAliases(['B', 'A', 'B', 'C', 'A'])).toEqual(['B', 'A', 'C'])
  })
})

describe('validateCompanyForm', () => {
  const existing = [
    { id: 1, name: '鈴友', is_active: true },
    { id: 2, name: '田中商店', is_active: true },
    { id: 3, name: '休業中', is_active: false },
  ]

  it('returns no errors for a valid new company', () => {
    const result = validateCompanyForm(
      { name: '新規会社', invoice_display_name: '', aliases: [], display_order: 10, is_active: true, memo: '' },
      existing,
      null
    )
    expect(result.errors).toEqual({})
    expect(result.isValid).toBe(true)
  })

  it('flags missing name', () => {
    const result = validateCompanyForm(
      { name: '', aliases: [] },
      existing,
      null
    )
    expect(result.errors.name).toBeTruthy()
    expect(result.isValid).toBe(false)
  })

  it('flags whitespace-only name as missing', () => {
    const result = validateCompanyForm(
      { name: '   ', aliases: [] },
      existing,
      null
    )
    expect(result.errors.name).toBeTruthy()
  })

  it('flags duplicate name against existing companies', () => {
    const result = validateCompanyForm(
      { name: '鈴友', aliases: [] },
      existing,
      null
    )
    expect(result.errors.name).toContain('重複')
  })

  it('allows same name when editing the same company', () => {
    const result = validateCompanyForm(
      { name: '鈴友', aliases: [] },
      existing,
      1
    )
    expect(result.errors).toEqual({})
  })

  it('detects duplicate even against inactive companies', () => {
    const result = validateCompanyForm(
      { name: '休業中', aliases: [] },
      existing,
      null
    )
    expect(result.errors.name).toContain('重複')
  })

  it('treats name comparison as trim-aware', () => {
    const result = validateCompanyForm(
      { name: '  鈴友  ', aliases: [] },
      existing,
      null
    )
    expect(result.errors.name).toContain('重複')
  })

  it('flags non-integer display_order', () => {
    const result = validateCompanyForm(
      { name: '新規', aliases: [], display_order: 'abc' },
      existing,
      null
    )
    expect(result.errors.display_order).toBeTruthy()
  })

  it('accepts numeric string display_order', () => {
    const result = validateCompanyForm(
      { name: '新規', aliases: [], display_order: '10' },
      existing,
      null
    )
    expect(result.errors.display_order).toBeUndefined()
  })
})
