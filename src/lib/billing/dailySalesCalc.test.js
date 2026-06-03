import { describe, expect, it } from 'vitest'
import {
  calcDailyDerived,
  calcMonthlySalesSummary,
} from './dailySalesCalc'

describe('calcDailyDerived', () => {
  it('returns zero-filled derived values for null/empty row', () => {
    expect(calcDailyDerived(null)).toEqual({
      total_sales: 0,
      fuel_total: 0,
      profit: 0,
    })
    expect(calcDailyDerived({})).toEqual({
      total_sales: 0,
      fuel_total: 0,
      profit: 0,
    })
  })

  it('sums vehicle sales into total_sales', () => {
    const result = calcDailyDerived({
      vehicle1_sales: 3000,
      vehicle2_sales: 5000,
      vehicle3_sales: 2000,
    })
    expect(result.total_sales).toBe(10000)
  })

  it('sums fuel into fuel_total', () => {
    const result = calcDailyDerived({
      vehicle1_fuel_yen: 1200,
      vehicle2_fuel_yen: 800,
    })
    expect(result.fuel_total).toBe(2000)
  })

  it('computes profit = total_sales - expense_amount - fuel_total', () => {
    const result = calcDailyDerived({
      vehicle1_sales: 5000,
      vehicle2_sales: 3000,
      vehicle3_sales: 2000,
      vehicle1_fuel_yen: 1000,
      vehicle2_fuel_yen: 500,
      expense_amount: 2000,
    })
    expect(result.total_sales).toBe(10000)
    expect(result.fuel_total).toBe(1500)
    expect(result.profit).toBe(10000 - 2000 - 1500)
  })

  it('handles null sales / fuel as 0', () => {
    const result = calcDailyDerived({
      vehicle1_sales: null,
      vehicle1_fuel_yen: null,
      expense_amount: 500,
    })
    expect(result.total_sales).toBe(0)
    expect(result.fuel_total).toBe(0)
    expect(result.profit).toBe(-500)
  })
})

describe('calcMonthlySalesSummary', () => {
  const dailySales = [
    {
      work_date: '2026-05-01',
      vehicle1_sales: 10000,
      vehicle2_sales: 5000,
      vehicle3_sales: 2000,
      vehicle1_fuel_yen: 1000,
      vehicle2_fuel_yen: 500,
      receivable_total: 3000,
      cash: 14000,
      expense_amount: 800,
    },
    {
      work_date: '2026-05-02',
      vehicle1_sales: 8000,
      vehicle2_sales: 0,
      vehicle3_sales: 0,
      vehicle1_fuel_yen: 700,
      vehicle2_fuel_yen: null,
      receivable_total: 0,
      cash: 8000,
      expense_amount: 200,
    },
  ]
  const staffSales = [
    { work_date: '2026-05-01', staff_name: 'チョロモン', sales: 17000, hours: 6 },
    { work_date: '2026-05-01', staff_name: '井上', sales: 0, hours: 8 },
    { work_date: '2026-05-02', staff_name: 'チョロモン', sales: 8000, hours: 4 },
  ]
  const staffRates = [
    { staff_name: 'チョロモン', rate_type: 'commission', commission_rate: 0.3 },
    { staff_name: '井上', rate_type: 'hourly', hourly_rate: 1150 },
  ]
  const fixedExpenses = [
    { label: '駐車場', amount: 5330 },
    { label: '保険', amount: 4930 },
  ]

  it('returns zero summary for empty inputs', () => {
    const result = calcMonthlySalesSummary([], [], [], [])
    expect(result.total_sales).toBe(0)
    expect(result.payroll_total).toBe(0)
    expect(result.estimated_profit).toBe(0)
  })

  it('sums daily totals correctly', () => {
    const result = calcMonthlySalesSummary(dailySales, staffSales, staffRates, fixedExpenses)
    expect(result.total_sales).toBe(17000 + 8000)
    expect(result.receivable_total).toBe(3000)
    expect(result.cash_total).toBe(22000)
    expect(result.expense_total).toBe(1000)
    expect(result.fuel_total).toBe(2200)
  })

  it('uses calcStaffPayroll for payroll_total', () => {
    const result = calcMonthlySalesSummary(dailySales, staffSales, staffRates, fixedExpenses)
    // チョロモン: 25000 * 0.3 = 7500
    // 井上: 8 * 1150 = 9200
    expect(result.payroll_total).toBe(7500 + 9200)
  })

  it('sums fixed expenses', () => {
    const result = calcMonthlySalesSummary(dailySales, staffSales, staffRates, fixedExpenses)
    expect(result.fixed_expense_total).toBe(5330 + 4930)
  })

  it('computes estimated_profit = total - expense - fuel - payroll - fixed', () => {
    const result = calcMonthlySalesSummary(dailySales, staffSales, staffRates, fixedExpenses)
    const expected =
      result.total_sales -
      result.expense_total -
      result.fuel_total -
      result.payroll_total -
      result.fixed_expense_total
    expect(result.estimated_profit).toBe(expected)
  })

  it('exposes per-staff payroll breakdown', () => {
    const result = calcMonthlySalesSummary(dailySales, staffSales, staffRates, fixedExpenses)
    expect(result.staff_payroll).toHaveLength(2)
    const choro = result.staff_payroll.find((s) => s.staff_name === 'チョロモン')
    expect(choro.payroll).toBe(7500)
  })
})
