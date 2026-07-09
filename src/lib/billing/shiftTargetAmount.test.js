import { describe, expect, it } from 'vitest'
import {
  computeDayTargetAmount,
  getPlannedShiftTimes,
  roundTargetDisplayAmount,
} from '@/lib/billing/shiftTargetAmount'

const employees = [
  { id: 'e1', name: '西村', hourly_wage: 1500 },
  { id: 'e2', name: 'たかし', hourly_wage: 1200 },
]

describe('getPlannedShiftTimes', () => {
  it('uses planned_start/planned_end when present', () => {
    expect(
      getPlannedShiftTimes({
        start: '20:00',
        end: '02:00',
        planned_start: '19:00',
        planned_end: '01:00',
      })
    ).toEqual({ start: '19:00', end: '01:00' })
  })
})

describe('computeDayTargetAmount', () => {
  it('ignores actual start/end when planned times exist', () => {
    const amount = computeDayTargetAmount({
      shifts: [
        {
          employee_id: 'e1',
          start: '20:00',
          end: '06:00',
          planned_start: '20:00',
          planned_end: '04:00',
        },
        {
          employee_id: 'e2',
          start: '20:00',
          end: '06:00',
          planned_start: '20:00',
          planned_end: '04:00',
        },
      ],
      employees,
      status: null,
    })
    // (1500 + 1200) * 8h + 3000 = 24600
    expect(amount).toBe(24600)
    expect(roundTargetDisplayAmount(amount)).toBe(25000)
  })

  it('falls back to start/end when planned times are missing', () => {
    const amount = computeDayTargetAmount({
      shifts: [
        {
          employee_id: 'e1',
          start: '20:00',
          end: '22:00',
        },
      ],
      employees,
      status: null,
    })
    expect(amount).toBe(1500 * 2 + 3000)
  })
})
