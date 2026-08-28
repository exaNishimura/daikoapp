import { describe, expect, it } from 'vitest'
import {
  formatShiftRequestDate,
  indexDayStatusByDate,
  isRegularClosedDay,
  sanitizeShiftRequestPayload,
} from './shiftDayStatus'

describe('shiftDayStatus', () => {
  it('formats date with Japanese weekday', () => {
    expect(formatShiftRequestDate('2026-09-01')).toBe('9月1日（火）')
    expect(formatShiftRequestDate('2026-09-06')).toBe('9月6日（日）')
  })

  it('indexes day status from shift rows', () => {
    const map = indexDayStatusByDate([
      { date: '2026-09-01', status: '定休日' },
      { date: '2026-09-02', car: 1, staff: 'A' },
      { date: '2026-09-03', status: '休業' },
    ])
    expect(map).toEqual({
      '2026-09-01': '定休日',
      '2026-09-03': '休業',
    })
  })

  it('clears availability on regular closed days when saving', () => {
    const payload = {
      days: {
        '2026-09-01': { available: true, start: '20:00', end: '06:00' },
        '2026-09-02': { available: true, start: '20:00', end: '06:00' },
      },
      notes: '',
    }
    const sanitized = sanitizeShiftRequestPayload(payload, { '2026-09-01': '定休日' })
    expect(sanitized.days['2026-09-01'].available).toBe(false)
    expect(sanitized.days['2026-09-02'].available).toBe(true)
    expect(isRegularClosedDay('定休日')).toBe(true)
    expect(isRegularClosedDay('休業')).toBe(false)
  })
})
