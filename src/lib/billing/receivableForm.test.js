import { describe, expect, it } from 'vitest'
import {
  EMPTY_RECEIVABLE_FORM,
  buildCompanyLookup,
  enrichReceivablesWithCompanies,
  getReceivableDisplayName,
  toBillingMonthFromWorkDate,
  validateReceivableForm,
} from './receivableForm'

describe('EMPTY_RECEIVABLE_FORM', () => {
  it('contains all editable fields with safe defaults', () => {
    expect(EMPTY_RECEIVABLE_FORM).toEqual({
      company_id: null,
      work_date: '',
      vehicle_num: '',
      departure: '',
      destination: '',
      amount: null,
      note: '',
    })
  })
})

describe('toBillingMonthFromWorkDate', () => {
  it('returns the first-day of the work_date month as YYYY-MM-DD', () => {
    expect(toBillingMonthFromWorkDate('2026-05-15')).toBe('2026-05-01')
    expect(toBillingMonthFromWorkDate('2026-12-31')).toBe('2026-12-01')
  })

  it('returns null for invalid input', () => {
    expect(toBillingMonthFromWorkDate(null)).toBeNull()
    expect(toBillingMonthFromWorkDate('')).toBeNull()
    expect(toBillingMonthFromWorkDate('not-a-date')).toBeNull()
    expect(toBillingMonthFromWorkDate('2026-13-01')).toBeNull()
  })
})

describe('validateReceivableForm', () => {
  const baseForm = {
    company_id: 1,
    work_date: '2026-05-15',
    departure: '白子',
    destination: '南旭が丘',
    amount: 8500,
    note: '',
  }

  it('returns no errors for a fully valid form', () => {
    const result = validateReceivableForm(baseForm, { year: 2026, month: 5 })
    expect(result.errors).toEqual({})
    expect(result.isValid).toBe(true)
  })

  it('flags missing company_id', () => {
    const result = validateReceivableForm({ ...baseForm, company_id: null }, { year: 2026, month: 5 })
    expect(result.errors.company_id).toBeTruthy()
  })

  it('flags missing work_date', () => {
    const result = validateReceivableForm({ ...baseForm, work_date: '' }, { year: 2026, month: 5 })
    expect(result.errors.work_date).toBeTruthy()
  })

  it('flags work_date outside of the target month', () => {
    const result = validateReceivableForm(
      { ...baseForm, work_date: '2026-06-01' },
      { year: 2026, month: 5 }
    )
    expect(result.errors.work_date).toContain('当月')
  })

  it('accepts work_date on the first day of the target month', () => {
    const result = validateReceivableForm(
      { ...baseForm, work_date: '2026-05-01' },
      { year: 2026, month: 5 }
    )
    expect(result.errors.work_date).toBeUndefined()
  })

  it('accepts work_date on the last day of the target month', () => {
    const result = validateReceivableForm(
      { ...baseForm, work_date: '2026-05-31' },
      { year: 2026, month: 5 }
    )
    expect(result.errors.work_date).toBeUndefined()
  })

  it('skips work_date month check when options.year/month is not provided', () => {
    const result = validateReceivableForm({ ...baseForm, work_date: '2026-08-15' }, {})
    expect(result.errors.work_date).toBeUndefined()
  })

  it('flags missing amount (null)', () => {
    const result = validateReceivableForm({ ...baseForm, amount: null }, {})
    expect(result.errors.amount).toBeTruthy()
  })

  it('flags negative amount', () => {
    const result = validateReceivableForm({ ...baseForm, amount: -100 }, {})
    expect(result.errors.amount).toBeTruthy()
  })

  it('flags non-integer amount', () => {
    const result = validateReceivableForm({ ...baseForm, amount: 100.5 }, {})
    expect(result.errors.amount).toBeTruthy()
  })

  it('accepts amount = 0 (free / cancelled jobs)', () => {
    const result = validateReceivableForm({ ...baseForm, amount: 0 }, {})
    expect(result.errors.amount).toBeUndefined()
  })
})

describe('enrichReceivablesWithCompanies', () => {
  it('JOIN が空でも company_id から companies を補完する', () => {
    const rows = [{ id: 1, company_id: 3, companies: null, amount: 5000 }]
    const companies = [{ id: 3, name: '鈴友', invoice_display_name: '株式会社 鈴友' }]
    const enriched = enrichReceivablesWithCompanies(rows, companies)
    expect(enriched[0].companies).toEqual(companies[0])
  })
})

describe('getReceivableDisplayName', () => {
  const lookup = buildCompanyLookup([
    { id: 3, name: '鈴友', invoice_display_name: '株式会社 鈴友' },
  ])

  it('JOIN 済みの請求先名を優先する', () => {
    expect(
      getReceivableDisplayName(
        { companies: { name: 'A', invoice_display_name: '株式会社 A' } },
        lookup
      )
    ).toBe('株式会社 A')
  })

  it('JOIN が無くても lookup で名前を解決する', () => {
    expect(getReceivableDisplayName({ company_id: 3, companies: null }, lookup)).toBe(
      '株式会社 鈴友'
    )
  })
})
