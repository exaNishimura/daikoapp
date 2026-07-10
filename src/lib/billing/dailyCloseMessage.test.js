import { describe, expect, it } from 'vitest'
import {
  buildDailyCloseMessage,
  getCloseTargetWorkDate,
  shouldSkipDailyClose,
} from '../../../shared/dailyClose/buildMessage.js'

const employees = [
  { id: 'e1', name: '西村', hourly_wage: 1500 },
  { id: 'e2', name: 'たかし', hourly_wage: 1200 },
]

describe('shouldSkipDailyClose', () => {
  it('skips closed and holiday', () => {
    expect(shouldSkipDailyClose('休業')).toBe(true)
    expect(shouldSkipDailyClose('定休日')).toBe(true)
    expect(shouldSkipDailyClose('')).toBe(false)
  })
})

describe('getCloseTargetWorkDate', () => {
  it('returns yesterday in JST', () => {
    const ref = new Date('2026-07-10T08:00:00+09:00')
    expect(getCloseTargetWorkDate(ref)).toBe('2026-07-09')
  })
})

describe('buildDailyCloseMessage', () => {
  it('formats vehicle section with receivable and expense breakdown', () => {
    const message = buildDailyCloseMessage({
      workDate: '2026-07-09',
      dow: '木',
      salesRow: {
        vehicle1_sales: 23500,
        vehicle1_fuel_yen: 0,
        vehicle1_expense_note: '徳丸🅿️代',
        vehicle1_expense_amount: 800,
      },
      shifts: [
        {
          car: '1',
          employee_id: 'e2',
          start: '20:00',
          end: '02:30',
          staff: 'たかし',
        },
        {
          car: '1',
          employee_id: 'e1',
          start: '20:00',
          end: '02:00',
          staff: 'なみ',
        },
      ],
      employees: [
        { id: 'e1', name: 'なみ', hourly_wage: 1200 },
        { id: 'e2', name: 'たかし', hourly_wage: 1200 },
      ],
      receivables: [
        { vehicle_num: 1, amount: 2000, company: { name: '徳丸工業' } },
        { vehicle_num: 1, amount: 3000, company: { name: '○○株式会社' } },
      ],
    })

    expect(message).toContain('売上 ¥23,500 / 燃料 ¥0')
    expect(message).toContain('売掛 ¥5,000（徳丸工業 ¥2,000、○○株式会社 ¥3,000）')
    expect(message).toContain('経費 ¥800（徳丸🅿️代 ¥800）')
    expect(message).toContain('現金 ¥17,700')
    expect(message).toContain('稼働: たかし　6.5h / なみ　6h')
    expect(message).not.toMatch(/^売掛 徳丸工業/m)
  })

  it('builds vehicle sections without daily summary', () => {
    const message = buildDailyCloseMessage({
      workDate: '2026-07-09',
      dow: '木',
      salesRow: { vehicle1_sales: 35500, vehicle2_sales: 0 },
      shifts: [
        {
          car: '1',
          employee_id: 'e1',
          planned_start: '20:00',
          planned_end: '04:00',
          start: '20:00',
          end: '04:00',
          staff: '西村',
        },
        {
          car: '1',
          employee_id: 'e2',
          planned_start: '20:00',
          planned_end: '04:00',
          start: '20:00',
          end: '04:00',
          staff: 'たかし',
        },
      ],
      employees,
      receivables: [{ vehicle_num: 1, amount: 5000, note: 'テスト' }],
      closedAtLabel: '2026/07/10 08:00',
    })

    expect(message).not.toContain('■ 日次サマリ')
    expect(message).not.toContain('目標:')
    expect(message).not.toContain('達成率:')
    expect(message).toContain('【7/9(木) 日次締め報告】')
    expect(message).toContain('■ 1号車')
    expect(message).toContain('西村')
    expect(message).toContain('締め時刻: 2026/07/10 08:00')
  })

  it('warns when operating car has no sales input', () => {
    const message = buildDailyCloseMessage({
      workDate: '2026-07-09',
      shifts: [
        { car: '1', employee_id: 'e1', start: '20:00', end: '04:00', staff: '西村' },
        { car: '2', employee_id: 'e2', start: '20:00', end: '04:00', staff: 'たかし' },
      ],
      employees,
      salesRow: { vehicle1_sales: 10000, vehicle2_sales: 0 },
    })

    expect(message).toContain('■ 2号車')
    expect(message).toContain('⚠ 未入力')
  })
})
