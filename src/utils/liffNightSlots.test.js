import { describe, expect, it } from 'vitest'
import {
  buildLiffNightSlots,
  firstAvailableSlot,
  formatLiffHourOptionLabel,
  formatLiffMinuteOptionLabel,
  occupiedFromSources,
} from './liffNightSlots'

describe('occupiedFromSources', () => {
  it('maps dispatch slots as-is and reservations to 30min windows', () => {
    const occupied = occupiedFromSources({
      units: [],
      slots: [{ start_at: '2025-08-13T11:00:00.000Z', end_at: '2025-08-13T11:40:00.000Z' }],
      reservations: [{ reserved_at: '2025-08-13T12:00:00.000Z' }],
    })
    expect(occupied).toHaveLength(2)
    expect(new Date(occupied[1].end).getTime() - new Date(occupied[1].start).getTime()).toBe(
      30 * 60 * 1000
    )
  })
})

describe('buildLiffNightSlots', () => {
  const nightDate = '2025-08-13'
  const now = new Date(2025, 7, 13, 16, 0)

  it('marks overlapping dispatch work as booked and picks the next free slot', () => {
    const pickup20 = new Date(2025, 7, 13, 20, 0)
    const occupiedIntervals = [
      { start: pickup20, end: new Date(pickup20.getTime() + 40 * 60 * 1000) },
    ]
    const slots = buildLiffNightSlots({
      nightDate,
      now,
      occupiedIntervals,
      settings: { weekday_fleet_count: 1, extra_capacity_max: 0 },
    })
    const at2000 = slots.find((s) => s.hour === 20 && s.minute === 0)
    const at2045 = slots.find((s) => s.hour === 20 && s.minute === 45)
    expect(at2000.booked).toBe(true)
    expect(at2000.available).toBe(false)
    expect(at2045.available).toBe(true)
    expect(firstAvailableSlot(slots)).toMatchObject({ hour: 20, minute: 45 })
  })

  it('does not offer past times on the current night', () => {
    const slots = buildLiffNightSlots({
      nightDate,
      now: new Date(2025, 7, 13, 21, 10),
      occupiedIntervals: [],
      settings: { extra_capacity_max: 0 },
    })
    expect(slots.find((s) => s.hour === 20 && s.minute === 0).past).toBe(true)
    expect(slots.find((s) => s.hour === 20 && s.minute === 0).available).toBe(false)
    expect(firstAvailableSlot(slots)).toMatchObject({ hour: 21, minute: 15 })
  })
})

describe('option labels', () => {
  it('appends 予約済み when the whole hour is taken', () => {
    const slots = [
      { hour: 20, minute: 0, available: false, booked: true, past: false },
      { hour: 20, minute: 15, available: false, booked: true, past: false },
      { hour: 20, minute: 30, available: false, booked: true, past: false },
      { hour: 20, minute: 45, available: false, booked: true, past: false },
    ]
    expect(formatLiffHourOptionLabel(20, slots)).toBe('20時（予約済み）')
    expect(formatLiffMinuteOptionLabel(slots[0])).toBe('00分（予約済み）')
  })
})
