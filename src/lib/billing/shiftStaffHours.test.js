import { describe, expect, it } from 'vitest'
import {
  applyShiftTimeUpdates,
  buildShiftTimeRows,
  buildShiftUpdatePayloads,
  calcShiftWorkHours,
  computeDayStaffHoursRows,
  computeLaborCostFromStaffHours,
  computeStaffHoursByCar,
  computeStaffHoursFromShifts,
  filterShiftsByCar,
  normalizeTimeForInput,
  sumShiftTimesHours,
} from './shiftStaffHours'

const employees = [{ id: '1', name: '西村' }, { id: '2', name: '井上' }]

describe('calcShiftWorkHours', () => {
  it('同日の勤務時間を計算する', () => {
    expect(calcShiftWorkHours('19:00', '23:00')).toBe(4)
  })

  it('翌日跨ぎを計算する', () => {
    expect(calcShiftWorkHours('22:00', '02:00')).toBe(4)
  })
})

describe('normalizeTimeForInput', () => {
  it('HH:MM:SS を HH:MM に正規化する', () => {
    expect(normalizeTimeForInput('19:30:00')).toBe('19:30')
    expect(normalizeTimeForInput('9:05')).toBe('09:05')
  })
})

describe('filterShiftsByCar', () => {
  it('号車でシフトを絞り込む', () => {
    const shifts = [
      { car: '1', staff: '西村' },
      { car: '2', staff: '井上' },
    ]
    expect(filterShiftsByCar(shifts, '1')).toHaveLength(1)
    expect(filterShiftsByCar(shifts, '1')[0].staff).toBe('西村')
  })
})

describe('computeStaffHoursByCar', () => {
  it('号車ごとにスタッフ時間を集計する', () => {
    const shifts = [
      { car: '1', staff: '西村', employee_id: '1', start: '19:00', end: '23:00' },
      { car: '2', staff: '井上', employee_id: '2', start: '20:00', end: '24:00' },
    ]
    const car1 = computeStaffHoursByCar(shifts, employees, '1')
    expect(car1.get('西村')).toBe(4)
    expect(car1.has('井上')).toBe(false)
  })
})

describe('computeStaffHoursFromShifts', () => {
  it('同一スタッフの複数シフトを合算する', () => {
    const shifts = [
      { staff: '西村', employee_id: '1', start: '19:00', end: '23:00' },
      { staff: '西村', employee_id: '1', start: '23:30', end: '01:00' },
    ]
    const map = computeStaffHoursFromShifts(shifts, employees)
    expect(map.get('西村')).toBe(5.5)
  })
})

describe('buildShiftTimeRows', () => {
  it('号車のシフト行を開始・終了付きで返す', () => {
    const shifts = [
      {
        id: 's1',
        car: '1',
        staff: '西村',
        employee_id: '1',
        role: '代行',
        start: '19:00:00',
        end: '23:00:00',
      },
      {
        id: 's2',
        car: '2',
        staff: '井上',
        employee_id: '2',
        role: '代行',
        start: '20:00',
        end: '24:00',
      },
    ]
    const rows = buildShiftTimeRows(shifts, employees, '1')
    expect(rows).toEqual([
      {
        shiftId: 's1',
        staffName: '西村',
        role: '代行',
        start: '19:00',
        end: '23:00',
      },
    ])
  })
})

describe('applyShiftTimeUpdates', () => {
  it('フォームの開始/終了をシフトにマージする', () => {
    const shifts = [
      { id: 's1', staff: '西村', employee_id: '1', start: '19:00', end: '23:00' },
    ]
    const merged = applyShiftTimeUpdates(shifts, [
      { shiftId: 's1', start: '20:00', end: '00:00' },
    ])
    expect(merged[0].start).toBe('20:00')
    expect(merged[0].end).toBe('00:00')
  })
})

describe('buildShiftUpdatePayloads', () => {
  it('シフト更新ペイロードを生成する', () => {
    const payloads = buildShiftUpdatePayloads([
      { shiftId: 's1', start: '20:00', end: '00:30' },
    ])
    expect(payloads).toEqual([
      { id: 's1', shiftData: { start: '20:00', end: '00:30' } },
    ])
  })

  it('開始・終了が既存シフトと同じ行は更新対象に含めない', () => {
    const dayShifts = [{ id: 's1', start: '20:00:00', end: '00:30:00' }]
    const payloads = buildShiftUpdatePayloads(
      [{ shiftId: 's1', start: '20:00', end: '00:30' }],
      dayShifts
    )
    expect(payloads).toEqual([])
  })

  it('開始・終了のいずれかが変わった行のみ更新する', () => {
    const dayShifts = [
      { id: 's1', start: '20:00:00', end: '00:30:00' },
      { id: 's2', start: '21:00:00', end: '01:00:00' },
    ]
    const payloads = buildShiftUpdatePayloads(
      [
        { shiftId: 's1', start: '20:00', end: '00:30' },
        { shiftId: 's2', start: '21:30', end: '01:00' },
      ],
      dayShifts
    )
    expect(payloads).toEqual([
      { id: 's2', shiftData: { start: '21:30', end: '01:00' } },
    ])
  })
})

describe('computeDayStaffHoursRows', () => {
  it('号車別の時間更新を含めて日次合計を算出する', () => {
    const shifts = [
      {
        id: 's1',
        car: '1',
        staff: '西村',
        employee_id: '1',
        start: '19:00',
        end: '23:00',
      },
      {
        id: 's2',
        car: '2',
        staff: '西村',
        employee_id: '1',
        start: '23:30',
        end: '01:00',
      },
    ]
    const rows = computeDayStaffHoursRows({
      dayShifts: shifts,
      employees,
      shiftTimeUpdates: [{ shiftId: 's1', start: '19:30', end: '23:30' }],
    })
    expect(rows).toEqual([{ staff_name: '西村', hours: 5.5 }])
  })
})

describe('computeLaborCostFromStaffHours', () => {
  it('稼働時間×時給の合計を算出する', () => {
    const employeesWithWage = [
      { name: '西村', hourly_wage: 1500 },
      { name: '井上', hourly_wage: 1200 },
    ]
    const cost = computeLaborCostFromStaffHours(
      [
        { staff_name: '西村', hours: 4 },
        { staff_name: '井上', hours: 3.5 },
      ],
      employeesWithWage
    )
    expect(cost).toBe(4 * 1500 + Math.round(3.5 * 1200))
  })

  it('マスタに無いスタッフは0円扱い', () => {
    expect(
      computeLaborCostFromStaffHours([{ staff_name: '臨時', hours: 5 }], [])
    ).toBe(0)
  })
})

describe('sumShiftTimesHours', () => {
  it('シフト時間の合計を返す', () => {
    expect(
      sumShiftTimesHours([
        { start: '19:00', end: '23:00' },
        { start: '23:30', end: '01:00' },
      ])
    ).toBe(5.5)
  })
})
