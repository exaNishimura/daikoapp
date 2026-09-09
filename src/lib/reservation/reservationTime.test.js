import { describe, expect, it } from 'vitest'
import {
  RESERVATION_HOURS,
  buildReservationIso,
  defaultReservationDateTime,
  formatReservationHourLabel,
  splitReservationDateTime,
} from './reservationTime'

describe('RESERVATION_HOURS', () => {
  it('runs 18 through next 5, skipping daytime', () => {
    expect(RESERVATION_HOURS).toEqual([18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5])
  })
})

describe('formatReservationHourLabel', () => {
  it('marks overnight hours', () => {
    expect(formatReservationHourLabel(18)).toBe('18時')
    expect(formatReservationHourLabel(0)).toBe('0時（深夜）')
    expect(formatReservationHourLabel(2)).toBe('2時（翌朝）')
  })
})

describe('buildReservationIso', () => {
  it('keeps 19:30 on the selected night', () => {
    const iso = buildReservationIso('2025-08-13', 19, 30)
    const d = new Date(iso)
    expect(d.getDate()).toBe(13)
    expect(d.getHours()).toBe(19)
    expect(d.getMinutes()).toBe(30)
  })

  it('rolls 2:15 to the next calendar morning', () => {
    const iso = buildReservationIso('2025-08-13', 2, 15)
    const d = new Date(iso)
    expect(d.getDate()).toBe(14)
    expect(d.getHours()).toBe(2)
    expect(d.getMinutes()).toBe(15)
  })
})

describe('splitReservationDateTime', () => {
  it('maps a 02:15 morning slot back to the previous business night', () => {
    const local = new Date(2025, 7, 14, 2, 15, 0, 0)
    const parts = splitReservationDateTime(local.toISOString())
    expect(parts).toEqual({ date: '2025-08-13', hour: 2, minute: 15 })
  })

  it('keeps an evening slot on that calendar night', () => {
    const local = new Date(2025, 7, 13, 19, 0, 0, 0)
    const parts = splitReservationDateTime(local.toISOString())
    expect(parts).toEqual({ date: '2025-08-13', hour: 19, minute: 0 })
  })
})

describe('defaultReservationDateTime', () => {
  it('uses 18:00 on the upcoming night when now is daytime', () => {
    const now = new Date(2025, 5, 1, 14, 20, 0, 0)
    expect(defaultReservationDateTime(now)).toEqual({ date: '2025-06-01', hour: 18, minute: 0 })
  })

  it('snaps to 15 minutes during evening hours', () => {
    const now = new Date(2025, 5, 1, 21, 10, 0, 0)
    expect(defaultReservationDateTime(now)).toEqual({ date: '2025-06-01', hour: 21, minute: 15 })
  })

  it('uses the previous calendar date before 06:00', () => {
    const now = new Date(2025, 5, 2, 3, 20, 0, 0)
    expect(defaultReservationDateTime(now)).toEqual({ date: '2025-06-01', hour: 3, minute: 15 })
  })
})
