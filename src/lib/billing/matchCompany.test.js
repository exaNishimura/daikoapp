import { describe, expect, it } from 'vitest'
import { matchCompany, findCandidateCompanies } from './matchCompany'

const companies = [
  {
    id: 1,
    name: '鈴友',
    invoice_display_name: '鈴友株式会社',
    aliases: ['鈴友', '鈴友(株)'],
    is_active: true,
  },
  { id: 2, name: '田中商事', invoice_display_name: null, aliases: ['田中'], is_active: true },
  { id: 3, name: '山田運輸', invoice_display_name: null, aliases: [], is_active: false },
  { id: 4, name: 'スズトモ商店', invoice_display_name: null, aliases: [], is_active: true },
]

describe('matchCompany', () => {
  it('returns null for empty / null input', () => {
    expect(matchCompany(null, companies)).toBeNull()
    expect(matchCompany('', companies)).toBeNull()
    expect(matchCompany('   ', companies)).toBeNull()
  })

  it('returns exact name match (highest priority)', () => {
    const m = matchCompany('鈴友', companies)
    expect(m).toMatchObject({ matched: true, kind: 'name', company: { id: 1 } })
  })

  it('returns alias match when name does not match exactly', () => {
    const m = matchCompany('鈴友(株)', companies)
    expect(m).toMatchObject({ matched: true, kind: 'alias', company: { id: 1 } })
  })

  it('returns invoice_display_name match', () => {
    const m = matchCompany('鈴友株式会社', companies)
    expect(m).toMatchObject({ matched: true, kind: 'invoice_display_name', company: { id: 1 } })
  })

  it('trims input', () => {
    const m = matchCompany('  田中商事  ', companies)
    expect(m).toMatchObject({ matched: true, company: { id: 2 } })
  })

  it('returns matched=false with candidates when partial match exists', () => {
    const m = matchCompany('スズトモ', companies)
    expect(m.matched).toBe(false)
    expect(m.candidates.map((c) => c.id)).toContain(4)
  })

  it('returns matched=false with no candidates for truly unknown', () => {
    const m = matchCompany('完全不明株式会社', companies)
    expect(m.matched).toBe(false)
    expect(m.candidates).toEqual([])
  })

  it('skips inactive companies in candidate suggestions when activeOnly=true', () => {
    const m = matchCompany('山田', companies, { activeOnly: true })
    expect(m.matched).toBe(false)
    expect(m.candidates.find((c) => c.id === 3)).toBeUndefined()
  })

  it('includes inactive companies by default', () => {
    const m = matchCompany('山田運輸', companies)
    expect(m.matched).toBe(true)
    expect(m.company.id).toBe(3)
  })
})

describe('findCandidateCompanies', () => {
  it('returns substring matches sorted by length', () => {
    const result = findCandidateCompanies('鈴', companies)
    expect(result.map((c) => c.id)).toContain(1)
    // 短い名前ほど前
    expect(result[0].id).toBe(1)
  })

  it('returns empty for empty input', () => {
    expect(findCandidateCompanies('', companies)).toEqual([])
    expect(findCandidateCompanies(null, companies)).toEqual([])
  })

  it('matches alias prefixes too', () => {
    const result = findCandidateCompanies('田', companies)
    expect(result.find((c) => c.id === 2)).toBeDefined()
  })

  it('limits result count', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: i + 100,
      name: `テスト${i}`,
      aliases: [],
      is_active: true,
    }))
    const result = findCandidateCompanies('テスト', many, { limit: 5 })
    expect(result).toHaveLength(5)
  })
})
