import { describe, expect, it } from 'vitest'
import { buildOperationStatusesFromShifts } from './shiftOperationUtils'
import {
  buildOperationalWindowsFromStatuses,
  buildTimelinePlacementBands,
  getEarliestOperationalStartTime,
  isVehicleOperational,
} from './operationStatusUtils'

describe('buildOperationStatusesFromShifts', () => {
  it('シフトの出勤時刻のみを稼働開始にする（終了は設定しない）', () => {
    const statuses = buildOperationStatusesFromShifts([{ start: '20:00', end: '02:00' }])

    expect(statuses).toEqual([
      { type: 'DAY_OFF', time: null },
      { type: 'START', time: '20:00' },
    ])
  })

  it('18:00出勤でもSTARTを明示する', () => {
    const statuses = buildOperationStatusesFromShifts([{ start: '18:00', end: '06:00' }])

    expect(statuses).toEqual([
      { type: 'DAY_OFF', time: null },
      { type: 'START', time: '18:00' },
    ])
  })

  it('複数シフトは最も早い出勤時刻をSTARTにする', () => {
    const statuses = buildOperationStatusesFromShifts([
      { start: '23:00', end: '02:00' },
      { start: '19:00', end: '22:00' },
    ])

    expect(statuses).toEqual([
      { type: 'DAY_OFF', time: null },
      { type: 'START', time: '19:00' },
    ])
  })
})

describe('isVehicleOperational with shift-based statuses', () => {
  const statuses = [
    { date: '2026-07-08', type: 'DAY_OFF', time: null },
    { date: '2026-07-08', type: 'START', time: '20:00' },
  ]

  it('出勤前は非稼働', () => {
    const beforeShift = new Date('2026-07-08T19:30:00')
    expect(isVehicleOperational('v1', beforeShift, statuses)).toBe(false)
  })

  it('出勤後は営業終了まで稼働', () => {
    const duringShift = new Date('2026-07-08T23:00:00')
    expect(isVehicleOperational('v1', duringShift, statuses)).toBe(true)

    const afterScheduledEnd = new Date('2026-07-09T03:00:00')
    expect(isVehicleOperational('v1', afterScheduledEnd, statuses)).toBe(true)
  })

  it('最も早い稼働開始時刻を返す', () => {
    const reference = new Date('2026-07-08T18:00:00')
    const earliest = getEarliestOperationalStartTime(statuses, reference)
    expect(earliest?.getHours()).toBe(20)
    expect(earliest?.getMinutes()).toBe(0)
  })
})

describe('buildTimelinePlacementBands', () => {
  it('出勤前を配置不可帯として返す', () => {
    const bands = buildTimelinePlacementBands([
      { type: 'DAY_OFF', time: null },
      { type: 'START', time: '20:00' },
    ])

    expect(bands.shiftStartTime).toBe('20:00')
    expect(bands.blockedBands).toEqual([{ startRow: 0, endRow: 8 }])
    expect(bands.placementBands).toEqual([{ startRow: 8, endRow: 48 }])
  })
})

describe('buildOperationalWindowsFromStatuses', () => {
  it('DEFAULTのみなら終日稼働', () => {
    const windows = buildOperationalWindowsFromStatuses([{ type: 'DEFAULT', time: null }])
    expect(windows).toEqual([{ startRow: 0, endRow: 48 }])
  })
})
