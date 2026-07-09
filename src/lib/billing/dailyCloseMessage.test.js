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
  it('includes target and achievement in header', () => {
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

    expect(message).toContain('■ 日次サマリ')
    expect(message).toContain('目標:')
    expect(message).toContain('総売上: ¥35,500')
    expect(message).toContain('達成率:')
    expect(message).toContain('■ 1号車')
    expect(message).toContain('西村')
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
