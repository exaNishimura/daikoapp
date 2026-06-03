import { describe, expect, it } from 'vitest'
import { receivableKey, findDuplicates } from './duplicateReceivables'

describe('receivableKey', () => {
  it('builds key from required fields', () => {
    const key = receivableKey({
      billing_month: '2026-05-01',
      company_id: 1,
      work_date: '2026-05-15',
      departure: 'A',
      destination: 'B',
      amount: 5000,
    })
    expect(key).toBe('2026-05-01|1|2026-05-15|A|B|5000')
  })

  it('normalizes null/undefined to empty', () => {
    const key = receivableKey({
      billing_month: '2026-05-01',
      company_id: 1,
      work_date: '2026-05-15',
      departure: null,
      destination: undefined,
      amount: 1000,
    })
    expect(key).toBe('2026-05-01|1|2026-05-15|||1000')
  })

  it('trims string fields', () => {
    const key = receivableKey({
      billing_month: '2026-05-01',
      company_id: 1,
      work_date: '2026-05-15',
      departure: '  A  ',
      destination: 'B ',
      amount: 1000,
    })
    expect(key).toBe('2026-05-01|1|2026-05-15|A|B|1000')
  })
})

describe('findDuplicates', () => {
  const existing = [
    {
      billing_month: '2026-05-01',
      company_id: 1,
      work_date: '2026-05-10',
      departure: 'X',
      destination: 'Y',
      amount: 3000,
    },
    {
      billing_month: '2026-05-01',
      company_id: 2,
      work_date: '2026-05-11',
      departure: 'P',
      destination: 'Q',
      amount: 5000,
    },
  ]

  it('returns empty for empty input', () => {
    expect(findDuplicates([], existing)).toEqual([])
    expect(findDuplicates(null, existing)).toEqual([])
  })

  it('marks rows duplicating existing as duplicate=true', () => {
    const incoming = [
      {
        billing_month: '2026-05-01',
        company_id: 1,
        work_date: '2026-05-10',
        departure: 'X',
        destination: 'Y',
        amount: 3000,
      },
      {
        billing_month: '2026-05-01',
        company_id: 1,
        work_date: '2026-05-12',
        departure: 'X',
        destination: 'Y',
        amount: 3000,
      },
    ]
    const result = findDuplicates(incoming, existing)
    expect(result[0].duplicate).toBe(true)
    expect(result[1].duplicate).toBe(false)
  })

  it('marks rows duplicating within incoming as duplicate=true', () => {
    const incoming = [
      {
        billing_month: '2026-05-01',
        company_id: 5,
        work_date: '2026-05-01',
        departure: 'A',
        destination: 'B',
        amount: 1000,
      },
      {
        billing_month: '2026-05-01',
        company_id: 5,
        work_date: '2026-05-01',
        departure: 'A',
        destination: 'B',
        amount: 1000,
      },
    ]
    const result = findDuplicates(incoming, [])
    expect(result[0].duplicate).toBe(false)
    expect(result[1].duplicate).toBe(true)
  })

  it('preserves original row data', () => {
    const incoming = [
      {
        billing_month: '2026-05-01',
        company_id: 1,
        work_date: '2026-05-10',
        departure: 'X',
        destination: 'Y',
        amount: 3000,
        note: '備考',
      },
    ]
    const result = findDuplicates(incoming, existing)
    expect(result[0]).toMatchObject({
      duplicate: true,
      note: '備考',
      amount: 3000,
    })
  })
})
