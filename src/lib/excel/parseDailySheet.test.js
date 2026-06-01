import { describe, expect, it } from 'vitest'
import { parseDailySheet, COL } from './parseDailySheet'

const PERIOD = { year: 2026, month: 5 }

/** 列インデックスを意識せずに行データを組み立てるヘルパー */
function makeDailyRow({
  day,
  dow = '',
  v1Dist = '',
  v2Dist = '',
  v1Fuel = '',
  v2Fuel = '',
  staff = {},
  v1Sales = '',
  v2Sales = '',
  v3Sales = '',
  totalSales = '',
  totalHours = '',
  receivableTotal = '',
  expenseNote = '',
  expenseAmount = '',
  cash = '',
  profit = '',
}) {
  const row = new Array(40).fill('')
  row[COL.day] = day
  row[COL.dow] = dow
  row[COL.v1Dist] = v1Dist
  row[COL.v2Dist] = v2Dist
  row[COL.v1Fuel] = v1Fuel
  row[COL.v2Fuel] = v2Fuel
  for (const s of COL.staff) {
    if (staff[s.name]) {
      row[s.sales] = staff[s.name].sales ?? ''
      row[s.hours] = staff[s.name].hours ?? ''
    }
  }
  row[COL.v1Sales] = v1Sales
  row[COL.v2Sales] = v2Sales
  row[COL.v3Sales] = v3Sales
  row[COL.totalSales] = totalSales
  row[COL.totalHours] = totalHours
  row[COL.receivableTotal] = receivableTotal
  row[COL.expenseNote] = expenseNote
  row[COL.expenseAmount] = expenseAmount
  row[COL.cash] = cash
  row[COL.profit] = profit
  return row
}

function makeFixedExpenseRow(label, amount) {
  const row = new Array(40).fill('')
  row[COL.expenseNote] = label
  row[COL.expenseAmount] = amount
  return row
}

describe('parseDailySheet', () => {
  it('parses a daily row from the May 2026 sample (5/1)', () => {
    const rows = [
      [], // header 0
      [], // header 1
      [], // header 2
      makeDailyRow({
        day: '1',
        dow: '金',
        v1Dist: '175km',
        v1Fuel: '¥3,000',
        staff: {
          西村: { sales: '¥41,000', hours: '9.50h' },
          たかし: { sales: '¥41,000', hours: '9.50h' },
        },
        v1Sales: '¥41,000',
        totalSales: '¥41,000',
        totalHours: '19.00h',
        receivableTotal: '¥6,500',
        cash: '¥31,500',
        profit: '¥15,200',
      }),
    ]
    const r = parseDailySheet(rows, PERIOD)
    expect(r.errors).toEqual([])
    expect(r.dailySales).toHaveLength(1)
    const d = r.dailySales[0]
    expect(d.workDate).toEqual(new Date(2026, 4, 1))
    expect(d.vehicle1DistanceKm).toBe(175)
    expect(d.vehicle1FuelYen).toBe(3000)
    expect(d.vehicle1Sales).toBe(41000)
    expect(d.totalSales).toBe(41000)
    expect(d.totalHours).toBe(19)
    expect(d.receivableTotal).toBe(6500)
    expect(d.cash).toBe(31500)
    expect(d.profit).toBe(15200)
  })

  it('extracts only non-zero staff sales', () => {
    const rows = [
      [],
      [],
      [],
      makeDailyRow({
        day: '1',
        staff: {
          西村: { sales: '¥41,000', hours: '9.50h' },
          たかし: { sales: '¥41,000', hours: '9.50h' },
        },
      }),
    ]
    const r = parseDailySheet(rows, PERIOD)
    expect(r.staffSales).toHaveLength(2)
    const names = r.staffSales.map((s) => s.staffName).sort()
    expect(names).toEqual(['たかし', '西村'])
    expect(r.staffSales.every((s) => s.workDate.getDate() === 1)).toBe(true)
  })

  it('treats unparseable day as a non-data row', () => {
    const rows = [
      [],
      [],
      [],
      makeDailyRow({
        day: '合計',
        v1Dist: '3,056km',
      }),
    ]
    const r = parseDailySheet(rows, PERIOD)
    expect(r.dailySales).toHaveLength(0)
    expect(r.errors).toHaveLength(0)
  })

  it('captures monthly fixed expenses from footer rows', () => {
    const rows = [
      [],
      [],
      [],
      makeFixedExpenseRow('共済掛金', '¥33,480'),
      makeFixedExpenseRow('損害保険(1)', '¥5,330'),
      makeFixedExpenseRow('駐車場', '¥5,330'),
      makeFixedExpenseRow('駐車場', '7210'), // dup label
      makeFixedExpenseRow('税理士', '¥11,000'),
      makeFixedExpenseRow('小計', '¥76,509'), // skip summary
      makeFixedExpenseRow('経費合計', '¥80,496'), // skip summary
    ]
    const r = parseDailySheet(rows, PERIOD)
    expect(r.fixedExpenses).toEqual([
      { label: '共済掛金', amount: 33480 },
      { label: '損害保険(1)', amount: 5330 },
      { label: '駐車場', amount: 5330 },
      { label: '駐車場_2', amount: 7210 },
      { label: '税理士', amount: 11000 },
    ])
  })

  it('skips empty rows', () => {
    const r = parseDailySheet([[], [], [], []], PERIOD)
    expect(r.dailySales).toHaveLength(0)
    expect(r.staffSales).toHaveLength(0)
    expect(r.fixedExpenses).toHaveLength(0)
    expect(r.errors).toHaveLength(0)
  })

  it('sums vehicle sales when totalSales cell is empty', () => {
    const rows = [
      [],
      [],
      [],
      makeDailyRow({
        day: '12',
        v1Sales: '¥13,500',
        v2Sales: '¥13,000',
        totalSales: '', // empty
      }),
    ]
    const r = parseDailySheet(rows, PERIOD)
    expect(r.dailySales[0].totalSales).toBe(26500)
  })
})
