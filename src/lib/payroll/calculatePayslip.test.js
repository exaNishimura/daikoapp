import { describe, expect, it } from 'vitest'
import {
  aggregateHoursByEmployee,
  buildDraftPayslipsForMonth,
  buildPayslipAmounts,
  toYearMonthStart,
} from './calculatePayslip.js'

describe('toYearMonthStart', () => {
  it('正規化する', () => {
    expect(toYearMonthStart('2026-08')).toBe('2026-08-01')
    expect(toYearMonthStart('2026-08-15')).toBe('2026-08-01')
  })
})

describe('aggregateHoursByEmployee', () => {
  const employees = [
    { id: 'e1', name: '西村', hourly_wage: 1500 },
    { id: 'e2', name: 'たかし', hourly_wage: 1200 },
  ]

  it('employee_id で集計', () => {
    const map = aggregateHoursByEmployee(
      [
        { employee_id: 'e1', staff: '西村', start: '20:00', end: '02:00' },
        { employee_id: 'e1', staff: '西村', start: '20:00', end: '00:00' },
      ],
      employees
    )
    expect(map.get('e1')).toBe(10)
  })
})

describe('buildPayslipAmounts', () => {
  it('時給×時間＋手当で総支給、乙欄で源泉', () => {
    const amounts = buildPayslipAmounts({
      employee: { hourly_wage: 1500, tax_table_type: 'OTSU', dependents_count: 0 },
      totalHours: 100,
      allowance: 5000,
    })
    expect(amounts.base_pay).toBe(150000)
    expect(amounts.gross_pay).toBe(155000)
    expect(amounts.withholding_tax).toBe(9200)
    expect(amounts.net_pay).toBe(amounts.taxable_base - amounts.withholding_tax)
  })
})

describe('buildDraftPayslipsForMonth', () => {
  it('EMPLOYED のみ・CONTRACT は除外', () => {
    const employees = [
      {
        id: 'e1',
        name: '雇用',
        hourly_wage: 1500,
        employment_type: 'EMPLOYED',
        is_active: true,
        tax_table_type: 'OTSU',
      },
      {
        id: 'e2',
        name: '委託',
        hourly_wage: 1500,
        employment_type: 'CONTRACT',
        is_active: true,
        tax_table_type: 'OTSU',
      },
    ]
    const drafts = buildDraftPayslipsForMonth({
      employees,
      shifts: [{ employee_id: 'e1', staff: '雇用', start: '20:00', end: '04:00' }],
      yearMonth: '2026-08',
    })
    expect(drafts).toHaveLength(1)
    expect(drafts[0].employee_id).toBe('e1')
    expect(drafts[0].total_hours).toBe(8)
    expect(drafts[0].status).toBe('DRAFT')
  })
})
