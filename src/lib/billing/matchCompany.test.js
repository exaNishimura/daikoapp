import { describe, expect, it } from 'vitest'
import { matchCompany, normalize } from './matchCompany'

const COMPANIES = [
  { id: 1, name: '徳丸', aliases: [] },
  { id: 2, name: '三重パーツ', aliases: [] },
  {
    id: 10,
    name: '鈴友',
    aliases: ['株式会社 鈴友', '(株)鈴友', '㈱鈴友'],
    invoice_display_name: '株式会社 鈴友',
  },
  { id: 12, name: '（株）ＵＥＴＡＫＡ', aliases: ['ＵＥＴＡＫＡ', 'UETAKA', '(株)UETAKA'] },
  { id: 14, name: 'Biss', aliases: [] },
  { id: 15, name: 'ゾンテック（株）', aliases: ['ゾンテック', 'ゾンテック株式会社'] },
]

describe('matchCompany', () => {
  it('exact name match', () => {
    const r = matchCompany('徳丸', COMPANIES)
    expect(r.companyId).toBe(1)
    expect(r.confidence).toBe('exact')
    expect(r.candidates).toHaveLength(1)
  })

  it('alias match', () => {
    const r = matchCompany('株式会社 鈴友', COMPANIES)
    expect(r.companyId).toBe(10)
    expect(r.confidence).toBe('alias')
  })

  it('normalized match: full-width parens / law-prefix variants', () => {
    expect(matchCompany('(株)鈴友', COMPANIES).companyId).toBe(10)
    expect(matchCompany('㈱鈴友', COMPANIES).companyId).toBe(10)
    expect(matchCompany('株式会社鈴友', COMPANIES).companyId).toBe(10)
    expect(matchCompany('株式会社  鈴友', COMPANIES).companyId).toBe(10)
  })

  it('trims trailing whitespace', () => {
    expect(matchCompany('鈴友 ', COMPANIES).companyId).toBe(10)
    expect(matchCompany('  鈴友', COMPANIES).companyId).toBe(10)
  })

  it('handles full-width / half-width Latin letters', () => {
    expect(matchCompany('UETAKA', COMPANIES).companyId).toBe(12)
    expect(matchCompany('uetaka', COMPANIES).companyId).toBe(12)
    expect(matchCompany('ＵＥＴＡＫＡ', COMPANIES).companyId).toBe(12)
    expect(matchCompany('（株）UETAKA', COMPANIES).companyId).toBe(12)
  })

  it('case-insensitive', () => {
    expect(matchCompany('biss', COMPANIES).companyId).toBe(14)
    expect(matchCompany('BISS', COMPANIES).companyId).toBe(14)
  })

  it('handles suffix variations of "ゾンテック（株）"', () => {
    expect(matchCompany('ゾンテック', COMPANIES).companyId).toBe(15)
    expect(matchCompany('ゾンテック株式会社', COMPANIES).companyId).toBe(15)
    expect(matchCompany('ゾンテック(株)', COMPANIES).companyId).toBe(15)
  })

  it('returns null when no match', () => {
    const r = matchCompany('未登録会社', COMPANIES)
    expect(r.companyId).toBeNull()
    expect(r.confidence).toBeNull()
    expect(r.candidates).toEqual([])
  })

  it('returns null for empty input', () => {
    expect(matchCompany('', COMPANIES).companyId).toBeNull()
    expect(matchCompany(null, COMPANIES).companyId).toBeNull()
    expect(matchCompany('   ', COMPANIES).companyId).toBeNull()
  })

  it('returns null companyId with multiple candidates when ambiguous', () => {
    const ambig = [
      { id: 1, name: 'テスト', aliases: ['テスト株式会社'] },
      { id: 2, name: 'テスト株式会社', aliases: [] },
    ]
    // both normalize to "テスト"
    const r = matchCompany('テスト', ambig)
    // exact match に "テスト" がヒットするので companyId=1 のはず
    expect(r.companyId).toBe(1)
    expect(r.confidence).toBe('exact')

    // exact が無い別の値で試す
    const r2 = matchCompany('テスト(株)', ambig)
    expect(r2.companyId).toBeNull()
    expect(r2.candidates.length).toBeGreaterThanOrEqual(2)
  })
})

describe('normalize', () => {
  it('drops legal prefixes and suffixes', () => {
    expect(normalize('株式会社鈴友')).toBe('鈴友')
    expect(normalize('鈴友株式会社')).toBe('鈴友')
    expect(normalize('(株)鈴友')).toBe('鈴友')
    expect(normalize('㈱鈴友')).toBe('鈴友')
  })

  it('NFKC normalizes full-width letters', () => {
    expect(normalize('ＵＥＴＡＫＡ')).toBe('uetaka')
    expect(normalize('（株）ＵＥＴＡＫＡ')).toBe('uetaka')
  })

  it('strips all whitespace including full-width', () => {
    expect(normalize('株式会社  鈴友')).toBe('鈴友')
    expect(normalize('株式会社\u3000鈴友')).toBe('鈴友')
  })
})
