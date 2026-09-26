import { describe, expect, it } from 'vitest'
import { findExactAvailableVehicle, isExactTimeFreeOnVehicle } from './slotUtils'

const V1 = { id: 'v1', name: '1号車' }
const V2 = { id: 'v2', name: '2号車' }

describe('isExactTimeFreeOnVehicle', () => {
  it('returns true when there are no overlapping slots', () => {
    const start = new Date(2026, 8, 25, 20, 0, 0, 0)
    expect(isExactTimeFreeOnVehicle([], start, 30)).toBe(true)
  })

  it('returns false when an existing slot overlaps the exact window', () => {
    const start = new Date(2026, 8, 25, 20, 0, 0, 0)
    const slots = [
      {
        start_at: new Date(2026, 8, 25, 20, 0, 0, 0).toISOString(),
        end_at: new Date(2026, 8, 25, 20, 30, 0, 0).toISOString(),
      },
    ]
    expect(isExactTimeFreeOnVehicle(slots, start, 30)).toBe(false)
  })

  it('returns false when the duration would pass 06:00', () => {
    const start = new Date(2026, 8, 26, 5, 45, 0, 0)
    expect(isExactTimeFreeOnVehicle([], start, 30)).toBe(false)
  })
})

describe('findExactAvailableVehicle', () => {
  const start = new Date(2026, 8, 25, 20, 0, 0, 0)

  it('picks the first vehicle that is free at the exact time', () => {
    const result = findExactAvailableVehicle(
      [V1, V2],
      [
        {
          vehicle_id: 'v1',
          start_at: start.toISOString(),
          end_at: new Date(2026, 8, 25, 20, 30, 0, 0).toISOString(),
        },
      ],
      start,
      30,
      {}
    )
    expect(result).toEqual({ vehicleId: 'v2', startAt: start })
  })

  it('returns null when every vehicle is occupied', () => {
    const occupying = {
      start_at: start.toISOString(),
      end_at: new Date(2026, 8, 25, 20, 30, 0, 0).toISOString(),
    }
    const result = findExactAvailableVehicle(
      [V1, V2],
      [
        { vehicle_id: 'v1', ...occupying },
        { vehicle_id: 'v2', ...occupying },
      ],
      start,
      30,
      {}
    )
    expect(result).toBeNull()
  })
})
