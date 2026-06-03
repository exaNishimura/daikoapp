import { describe, expect, it } from 'vitest'
import { buildImportPlan } from './buildImportPlan'

const parsed = {
  period: { year: 2026, month: 5 },
  sourceFile: '202605稼働管理表new.xlsx',
  dailySales: [
    {
      workDate: new Date(Date.UTC(2026, 4, 1)),
      vehicle1DistanceKm: 100,
      vehicle2DistanceKm: 80,
      vehicle1FuelYen: 5000,
      vehicle2FuelYen: 4000,
      vehicle1Sales: 30000,
      vehicle2Sales: 20000,
      vehicle3Sales: 0,
      totalSales: 50000,
      totalHours: 14,
      receivableTotal: 10000,
      expenseNote: null,
      expenseAmount: 0,
      cash: 40000,
      profit: 41000,
    },
  ],
  staffSales: [
    {
      workDate: new Date(Date.UTC(2026, 4, 1)),
      staffName: 'チョロモン',
      sales: 30000,
      hours: 6,
    },
  ],
  receivables: [
    {
      companyName: '鈴友',
      workDate: new Date(Date.UTC(2026, 4, 5)),
      departure: 'A',
      destination: 'B',
      amount: 5000,
      note: null,
    },
    {
      companyName: '田中商事',
      workDate: new Date(Date.UTC(2026, 4, 10)),
      departure: 'C',
      destination: 'D',
      amount: 3000,
      note: null,
    },
    {
      companyName: '謎の会社',
      workDate: new Date(Date.UTC(2026, 4, 15)),
      departure: null,
      destination: null,
      amount: 1500,
      note: null,
    },
  ],
  fixedExpenses: [
    { label: '駐車場', amount: 5330 },
    { label: '保険', amount: 4930 },
  ],
  errors: [],
}

const companyMap = {
  '鈴友': 1,
  '田中商事': 2,
  // '謎の会社' は意図的にマップから抜く (= skip 扱い)
}

describe('buildImportPlan', () => {
  it('builds period and source_file', () => {
    const plan = buildImportPlan(parsed, { companyMap, duplicates: new Set() })
    expect(plan.period).toBe('2026-05-01')
    expect(plan.source_file).toBe('202605稼働管理表new.xlsx')
  })

  it('maps daily sales with snake_case columns', () => {
    const plan = buildImportPlan(parsed, { companyMap, duplicates: new Set() })
    expect(plan.daily_sales).toHaveLength(1)
    expect(plan.daily_sales[0]).toMatchObject({
      work_date: '2026-05-01',
      vehicle1_distance_km: 100,
      vehicle2_distance_km: 80,
      vehicle1_fuel_yen: 5000,
      vehicle2_fuel_yen: 4000,
      vehicle1_sales: 30000,
      vehicle2_sales: 20000,
      vehicle3_sales: 0,
      total_hours: 14,
      receivable_total: 10000,
      expense_amount: 0,
      cash: 40000,
    })
  })

  it('maps staff sales', () => {
    const plan = buildImportPlan(parsed, { companyMap, duplicates: new Set() })
    expect(plan.staff_sales).toEqual([
      { work_date: '2026-05-01', staff_name: 'チョロモン', sales: 30000, hours: 6 },
    ])
  })

  it('maps receivables and skips rows without companyMap entry', () => {
    const plan = buildImportPlan(parsed, { companyMap, duplicates: new Set() })
    expect(plan.receivables).toHaveLength(2)
    expect(plan.receivables[0]).toMatchObject({
      company_id: 1,
      work_date: '2026-05-05',
      departure: 'A',
      destination: 'B',
      amount: 5000,
      billing_month: '2026-05-01',
    })
    expect(plan.skipped_receivables).toBe(1)
  })

  it('excludes duplicates from receivables payload', () => {
    const dupKey = '2026-05-01|1|2026-05-05|A|B|5000'
    const plan = buildImportPlan(parsed, {
      companyMap,
      duplicates: new Set([dupKey]),
    })
    expect(plan.receivables).toHaveLength(1)
    expect(plan.receivables[0].company_id).toBe(2)
    expect(plan.duplicate_count).toBe(1)
  })

  it('maps fixed expenses with billing_month', () => {
    const plan = buildImportPlan(parsed, { companyMap, duplicates: new Set() })
    expect(plan.fixed_expenses).toEqual([
      { billing_month: '2026-05-01', label: '駐車場', amount: 5330 },
      { billing_month: '2026-05-01', label: '保険', amount: 4930 },
    ])
  })

  it('throws when period is missing', () => {
    expect(() =>
      buildImportPlan({ ...parsed, period: null }, { companyMap, duplicates: new Set() })
    ).toThrow(/period/)
  })

  it('counts mapped vs unmapped companies', () => {
    const plan = buildImportPlan(parsed, { companyMap, duplicates: new Set() })
    expect(plan.summary).toMatchObject({
      daily_count: 1,
      staff_count: 1,
      receivable_count: 2,
      fixed_count: 2,
      unmapped_companies: 1,
    })
  })
})
