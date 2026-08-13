import { describe, expect, it } from 'vitest'
import { daysOverdue, isOverdue60, summarizeUnpaidInvoices } from './invoiceAging'

describe('daysOverdue', () => {
  it('returns 0 when issue_date is today', () => {
    const today = new Date('2026-06-01T12:00:00Z')
    expect(daysOverdue('2026-06-01', today)).toBe(0)
  })

  it('counts past days from issue_date', () => {
    const today = new Date('2026-06-01T12:00:00Z')
    expect(daysOverdue('2026-05-01', today)).toBe(31)
    expect(daysOverdue('2026-04-02', today)).toBe(60)
    expect(daysOverdue('2026-04-01', today)).toBe(61)
  })

  it('returns null on invalid input', () => {
    expect(daysOverdue(null)).toBeNull()
    expect(daysOverdue('invalid')).toBeNull()
    expect(daysOverdue('2026-13-01')).toBeNull()
  })

  it('returns 0 for future issue_date (cannot be overdue)', () => {
    const today = new Date('2026-06-01T12:00:00Z')
    expect(daysOverdue('2026-07-01', today)).toBe(0)
  })
})

describe('isOverdue60', () => {
  it('true when > 60 days', () => {
    const today = new Date('2026-06-01T12:00:00Z')
    expect(isOverdue60('2026-04-01', today)).toBe(true)
  })

  it('false at exactly 60 days', () => {
    const today = new Date('2026-06-01T12:00:00Z')
    expect(isOverdue60('2026-04-02', today)).toBe(false)
  })

  it('false on null input', () => {
    expect(isOverdue60(null)).toBe(false)
  })
})

describe('summarizeUnpaidInvoices', () => {
  const today = new Date('2026-06-01T12:00:00Z')

  it('handles empty / null input', () => {
    expect(summarizeUnpaidInvoices([], today)).toEqual({
      total_unpaid: 0,
      invoice_count: 0,
      average_days_overdue: 0,
      over_60_count: 0,
      by_company: [],
    })
    expect(summarizeUnpaidInvoices(null, today).invoice_count).toBe(0)
  })

  it('ignores invoices with paid_at set', () => {
    const invoices = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2026-05-01',
        total_amount: 10000,
        paid_at: '2026-05-20',
        companies: { name: 'A' },
      },
      {
        id: 2,
        company_id: 1,
        issue_date: '2026-05-01',
        total_amount: 5000,
        paid_at: null,
        companies: { name: 'A' },
      },
    ]
    const result = summarizeUnpaidInvoices(invoices, today)
    expect(result.invoice_count).toBe(1)
    expect(result.total_unpaid).toBe(5000)
  })

  it('aggregates by company and sorts by total desc', () => {
    const invoices = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2026-05-01',
        total_amount: 1000,
        paid_at: null,
        companies: { name: 'A' },
      },
      {
        id: 2,
        company_id: 2,
        issue_date: '2026-05-01',
        total_amount: 5000,
        paid_at: null,
        companies: { name: 'B' },
      },
      {
        id: 3,
        company_id: 2,
        issue_date: '2026-04-01',
        total_amount: 3000,
        paid_at: null,
        companies: { name: 'B' },
      },
    ]
    const result = summarizeUnpaidInvoices(invoices, today)
    expect(result.invoice_count).toBe(3)
    expect(result.total_unpaid).toBe(9000)
    expect(result.by_company).toHaveLength(2)
    expect(result.by_company[0]).toMatchObject({
      company_id: 2,
      company_name: 'B',
      invoice_count: 2,
      total_unpaid: 8000,
    })
    expect(result.by_company[1]).toMatchObject({
      company_id: 1,
      company_name: 'A',
      invoice_count: 1,
      total_unpaid: 1000,
    })
  })

  it('computes average days overdue and over_60 count', () => {
    const invoices = [
      {
        id: 1,
        company_id: 1,
        issue_date: '2026-04-01',
        total_amount: 1000,
        paid_at: null,
        companies: { name: 'A' },
      }, // 61 days
      {
        id: 2,
        company_id: 1,
        issue_date: '2026-05-01',
        total_amount: 1000,
        paid_at: null,
        companies: { name: 'A' },
      }, // 31 days
    ]
    const result = summarizeUnpaidInvoices(invoices, today)
    expect(result.average_days_overdue).toBe(46) // (61 + 31) / 2
    expect(result.over_60_count).toBe(1)
  })
})
