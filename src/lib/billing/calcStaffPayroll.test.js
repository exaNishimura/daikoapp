import { describe, expect, it } from 'vitest'
import { calcStaffPayroll } from './calcStaffPayroll'

const rates = [
  { staff_name: 'チョロモン', rate_type: 'commission', commission_rate: 0.3, hourly_rate: null },
  { staff_name: '井上', rate_type: 'hourly', hourly_rate: 1150, commission_rate: null },
  { staff_name: '伊藤', rate_type: 'hourly', hourly_rate: 1300, commission_rate: null },
  { staff_name: '臨時2', rate_type: 'hourly', hourly_rate: 1000, commission_rate: null },
]

const sales = [
  { work_date: '2026-05-01', staff_name: 'チョロモン', sales: 30000, hours: 6 },
  { work_date: '2026-05-02', staff_name: 'チョロモン', sales: 20000, hours: 4 },
  { work_date: '2026-05-01', staff_name: '井上', sales: 0, hours: 8 },
  { work_date: '2026-05-02', staff_name: '井上', sales: 0, hours: 4.5 },
  { work_date: '2026-05-01', staff_name: '伊藤', sales: 0, hours: 7.25 },
]

describe('calcStaffPayroll', () => {
  it('returns empty array for empty input', () => {
    expect(calcStaffPayroll([], rates)).toEqual([])
    expect(calcStaffPayroll(null, rates)).toEqual([])
  })

  it('aggregates sales and hours per staff', () => {
    const result = calcStaffPayroll(sales, rates)
    const choro = result.find((r) => r.staff_name === 'チョロモン')
    expect(choro.total_sales).toBe(50000)
    expect(choro.total_hours).toBe(10)

    const inoue = result.find((r) => r.staff_name === '井上')
    expect(inoue.total_sales).toBe(0)
    expect(inoue.total_hours).toBe(12.5)
  })

  it('computes payroll for commission rate', () => {
    const result = calcStaffPayroll(sales, rates)
    const choro = result.find((r) => r.staff_name === 'チョロモン')
    expect(choro.rate_type).toBe('commission')
    expect(choro.commission_rate).toBe(0.3)
    expect(choro.payroll).toBe(15000) // 50000 * 0.3
  })

  it('computes payroll for hourly rate', () => {
    const result = calcStaffPayroll(sales, rates)
    const inoue = result.find((r) => r.staff_name === '井上')
    expect(inoue.rate_type).toBe('hourly')
    expect(inoue.hourly_rate).toBe(1150)
    expect(inoue.payroll).toBe(Math.round(12.5 * 1150))

    const ito = result.find((r) => r.staff_name === '伊藤')
    expect(ito.payroll).toBe(Math.round(7.25 * 1300))
  })

  it('returns unknown rate_type for staff missing in rates', () => {
    const result = calcStaffPayroll(
      [{ work_date: '2026-05-01', staff_name: '謎のスタッフ', sales: 1000, hours: 1 }],
      rates
    )
    expect(result[0]).toMatchObject({
      staff_name: '謎のスタッフ',
      rate_type: 'unknown',
      payroll: 0,
    })
  })

  it('total payroll matches sum of individual payrolls', () => {
    const result = calcStaffPayroll(sales, rates)
    const total = result.reduce((s, r) => s + r.payroll, 0)
    expect(total).toBe(15000 + Math.round(12.5 * 1150) + Math.round(7.25 * 1300))
  })

  it('handles 0 hours / 0 sales gracefully', () => {
    const result = calcStaffPayroll(
      [{ work_date: '2026-05-01', staff_name: '井上', sales: 0, hours: 0 }],
      rates
    )
    expect(result[0].payroll).toBe(0)
  })

  it('skips staff with no sales rows in the period (only rates left)', () => {
    const result = calcStaffPayroll(sales, rates)
    expect(result.find((r) => r.staff_name === '臨時2')).toBeUndefined()
  })

  it('sorts results by display_order if available in rates', () => {
    const ratesWithOrder = [
      { staff_name: 'B', rate_type: 'hourly', hourly_rate: 1000, display_order: 2 },
      { staff_name: 'A', rate_type: 'hourly', hourly_rate: 1000, display_order: 1 },
    ]
    const result = calcStaffPayroll(
      [
        { work_date: '2026-05-01', staff_name: 'B', sales: 0, hours: 1 },
        { work_date: '2026-05-01', staff_name: 'A', sales: 0, hours: 1 },
      ],
      ratesWithOrder
    )
    expect(result.map((r) => r.staff_name)).toEqual(['A', 'B'])
  })
})
