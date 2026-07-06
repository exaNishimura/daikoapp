import { describe, expect, it } from 'vitest'
import { calcDailyDerived, calcMonthlySalesSummary, computeCashFromShiftSales, getDailyTotalSales, indexDailySalesByDate, toWorkDateKey } from './dailySalesCalc'

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

  it('sums vehicle1/2 sales into total_sales (vehicle3 廃止)', () => {
    const result = calcDailyDerived({
      vehicle1_sales: 3000,
      vehicle2_sales: 5000,
    })
    expect(result.total_sales).toBe(8000)
  })

  it('prefers DB total_sales column when present', () => {
    const result = calcDailyDerived({
      vehicle1_sales: 0,
      vehicle2_sales: 0,
      total_sales: 42000,
    })
    expect(result.total_sales).toBe(42000)
  })

  it('ignores vehicle3_sales even if present (legacy data)', () => {
    const result = calcDailyDerived({
      vehicle1_sales: 3000,
      vehicle2_sales: 5000,
      vehicle3_sales: 999,
    })
    expect(result.total_sales).toBe(8000)
  })

  it('sums fuel into fuel_total', () => {
    const result = calcDailyDerived({
      vehicle1_fuel_yen: 1200,
      vehicle2_fuel_yen: 800,
    })
    expect(result.fuel_total).toBe(2000)
  })

  it('computes profit = total_sales - expense - fuel - labor_cost', () => {
    const result = calcDailyDerived({
      vehicle1_sales: 5000,
      vehicle2_sales: 3000,
      vehicle1_fuel_yen: 1000,
      vehicle2_fuel_yen: 500,
      expense_amount: 2000,
      labor_cost: 1500,
    })
    expect(result.total_sales).toBe(8000)
    expect(result.fuel_total).toBe(1500)
    expect(result.profit).toBe(8000 - 2000 - 1500 - 1500)
  })

  it('handles null sales / fuel / labor_cost as 0', () => {
    const result = calcDailyDerived({
      vehicle1_sales: null,
      vehicle1_fuel_yen: null,
      expense_amount: 500,
      labor_cost: null,
    })
    expect(result.total_sales).toBe(0)
    expect(result.fuel_total).toBe(0)
    expect(result.profit).toBe(-500)
  })
})

describe('computeCashFromShiftSales', () => {
  it('総売上 - 経費 - 売掛で現金を算出する', () => {
    expect(
      computeCashFromShiftSales({
        vehicle1_sales: 50000,
        vehicle2_sales: 30000,
        expense_amount: 5000,
        receivable_total: 12000,
      })
    ).toBe(63000)
  })

  it('マイナスは0に丸める', () => {
    expect(
      computeCashFromShiftSales({
        vehicle1_sales: 10000,
        vehicle2_sales: 0,
        expense_amount: 8000,
        receivable_total: 5000,
      })
    ).toBe(0)
  })
})

describe('toWorkDateKey', () => {
  it('normalizes ISO date strings', () => {
    expect(toWorkDateKey('2026-07-06')).toBe('2026-07-06')
    expect(toWorkDateKey('2026-07-06T00:00:00.000Z')).toBe('2026-07-06')
  })
})

describe('indexDailySalesByDate', () => {
  it('indexes rows by normalized work_date', () => {
    const map = indexDailySalesByDate([
      { work_date: '2026-07-06T00:00:00.000Z', total_sales: 10000 },
    ])
    expect(map['2026-07-06']?.total_sales).toBe(10000)
  })
})

describe('getDailyTotalSales', () => {
  it('returns total_sales from daily_sales row', () => {
    expect(getDailyTotalSales({ total_sales: 35000 })).toBe(35000)
    expect(getDailyTotalSales(null)).toBe(0)
  })
})

describe('calcMonthlySalesSummary', () => {
  const dailySales = [
    {
      work_date: '2026-05-01',
      vehicle1_sales: 10000,
      vehicle2_sales: 5000,
      vehicle1_fuel_yen: 1000,
      vehicle2_fuel_yen: 500,
      receivable_total: 3000,
      cash: 14000,
      expense_amount: 800,
      labor_cost: 5000,
    },
    {
      work_date: '2026-05-02',
      vehicle1_sales: 8000,
      vehicle2_sales: 0,
      vehicle1_fuel_yen: 700,
      vehicle2_fuel_yen: null,
      receivable_total: 0,
      cash: 8000,
      expense_amount: 200,
      labor_cost: 2000,
    },
  ]
  const fixedExpenses = [
    { label: '駐車場', amount: 5330 },
    { label: '保険', amount: 4930 },
  ]

  it('returns zero summary for empty inputs', () => {
    const result = calcMonthlySalesSummary([], [])
    expect(result.total_sales).toBe(0)
    expect(result.labor_cost_total).toBe(0)
    expect(result.estimated_profit).toBe(0)
  })

  it('sums daily totals correctly', () => {
    const result = calcMonthlySalesSummary(dailySales, fixedExpenses)
    expect(result.total_sales).toBe(15000 + 8000)
    expect(result.receivable_total).toBe(3000)
    expect(result.cash_total).toBe(22000)
    expect(result.expense_total).toBe(1000)
    expect(result.fuel_total).toBe(2200)
    expect(result.labor_cost_total).toBe(7000)
  })

  it('sums fixed expenses', () => {
    const result = calcMonthlySalesSummary(dailySales, fixedExpenses)
    expect(result.fixed_expense_total).toBe(5330 + 4930)
  })

  it('computes estimated_profit = total - expense - fuel - labor - fixed', () => {
    const result = calcMonthlySalesSummary(dailySales, fixedExpenses)
    const expected =
      result.total_sales -
      result.expense_total -
      result.fuel_total -
      result.labor_cost_total -
      result.fixed_expense_total
    expect(result.estimated_profit).toBe(expected)
  })
})
