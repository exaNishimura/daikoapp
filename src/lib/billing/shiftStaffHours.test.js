import { describe, expect, it } from 'vitest'
import {
  buildStaffHoursRows,
  buildStaffRowsForSave,
  calcShiftWorkHours,
  computeStaffHoursByCar,
  computeStaffHoursFromShifts,
  filterShiftsByCar,
  sumStaffHours,
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

describe('buildStaffHoursRows', () => {
  it('号車のシフトにいるスタッフのみ表示する', () => {
    const shifts = [
      { car: '1', staff: '西村', employee_id: '1', start: '19:00', end: '23:00' },
      { car: '2', staff: '井上', employee_id: '2', start: '20:00', end: '24:00' },
    ]
    const rows = buildStaffHoursRows(shifts, employees, [], '1')
    expect(rows).toEqual([{ staffName: '西村', hours: '4' }])
  })

  it('単一号車のみの保存済み時間を号車表示に使う', () => {
    const shifts = [{ car: '1', staff: '西村', employee_id: '1', start: '19:00', end: '23:00' }]
    const saved = [{ staff_name: '西村', hours: 6 }]
    const rows = buildStaffHoursRows(shifts, employees, saved, '1')
    expect(rows).toEqual([{ staffName: '西村', hours: '6' }])
  })
})

describe('buildStaffRowsForSave', () => {
  it('号車別入力を日次合計にマージする', () => {
    const shifts = [
      { car: '1', staff: '西村', employee_id: '1', start: '19:00', end: '23:00' },
      { car: '2', staff: '西村', employee_id: '1', start: '23:30', end: '01:00' },
    ]
    const rows = buildStaffRowsForSave({
      workDate: '2026-07-01',
      carNum: '1',
      formStaffHours: [{ staffName: '西村', hours: '5' }],
      dayShifts: shifts,
      employees,
      existingStaffRows: [],
    })
    expect(rows[0].hours).toBe(6.5)
  })
})

describe('sumStaffHours', () => {
  it('スタッフ時間の合計を返す', () => {
    expect(
      sumStaffHours([
        { staffName: 'A', hours: '4' },
        { staffName: 'B', hours: '3.5' },
      ])
    ).toBe(7.5)
  })
})
