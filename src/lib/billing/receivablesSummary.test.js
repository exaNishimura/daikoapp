import { describe, expect, it } from 'vitest'
import { summarizeReceivables } from './receivablesSummary'

const rows = [
  {
    id: 1,
    company_id: 10,
    amount: 3000,
    invoice_id: null,
    companies: { id: 10, name: '鈴友', invoice_display_name: '株式会社 鈴友' },
    invoices: null,
  },
  {
    id: 2,
    company_id: 10,
    amount: 5000,
    invoice_id: null,
    companies: { id: 10, name: '鈴友', invoice_display_name: '株式会社 鈴友' },
    invoices: null,
  },
  {
    id: 3,
    company_id: 20,
    amount: 2000,
    invoice_id: 99,
    companies: { id: 20, name: '田中商店', invoice_display_name: null },
    invoices: { id: 99, paid_at: null },
  },
  {
    id: 4,
    company_id: 30,
    amount: 1500,
    invoice_id: 100,
    companies: { id: 30, name: 'A社' },
    invoices: { id: 100, paid_at: '2026-06-01' },
  },
]

describe('summarizeReceivables', () => {
  it('returns zeros for empty input', () => {
    expect(summarizeReceivables([])).toEqual({
      count: 0,
      totalAmount: 0,
      byCompany: [],
    })
    expect(summarizeReceivables(null)).toEqual({
      count: 0,
      totalAmount: 0,
      byCompany: [],
    })
  })

  it('counts rows and sums amounts', () => {
    const result = summarizeReceivables(rows)
    expect(result.count).toBe(4)
    expect(result.totalAmount).toBe(3000 + 5000 + 2000 + 1500)
  })

  it('groups by company with name and totals', () => {
    const result = summarizeReceivables(rows)
    expect(result.byCompany).toHaveLength(3)
    const byId = Object.fromEntries(result.byCompany.map((c) => [c.companyId, c]))
    expect(byId[10]).toMatchObject({
      companyId: 10,
      companyName: '鈴友',
      count: 2,
      total: 8000,
    })
    expect(byId[20]).toMatchObject({ companyId: 20, count: 1, total: 2000 })
    expect(byId[30]).toMatchObject({ companyId: 30, count: 1, total: 1500 })
  })

  it('sorts byCompany by total descending', () => {
    const result = summarizeReceivables(rows)
    const totals = result.byCompany.map((c) => c.total)
    expect(totals).toEqual([...totals].sort((a, b) => b - a))
  })

  it('handles missing company gracefully', () => {
    const result = summarizeReceivables([
      { id: 1, company_id: 99, amount: 100, companies: null },
    ])
    expect(result.byCompany[0]).toMatchObject({
      companyId: 99,
      companyName: '(取引先未設定)',
      count: 1,
      total: 100,
    })
  })

  it('treats null amount as 0', () => {
    const result = summarizeReceivables([
      { id: 1, company_id: 10, amount: null, companies: { id: 10, name: 'A' } },
      { id: 2, company_id: 10, amount: 500, companies: { id: 10, name: 'A' } },
    ])
    expect(result.totalAmount).toBe(500)
  })
})
