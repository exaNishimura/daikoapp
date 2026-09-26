import { describe, expect, it } from 'vitest'
import {
  HOLD_ADDRESS,
  TAP_HOLD_ROWS,
  assessHoldRange,
  isUnfilledHold,
  resolveDrawRange,
} from './holdSlot'
import { rowIndexToDate } from '@/utils/rowUtils'

const businessDay = new Date(2026, 8, 26)

describe('resolveDrawRange', () => {
  it('tap creates 30 minutes from the anchor row', () => {
    expect(resolveDrawRange(4, 4, false, 43)).toEqual({
      startRow: 4,
      endRow: 4 + TAP_HOLD_ROWS,
    })
  })

  it('drag includes every row from the anchor through the current row', () => {
    expect(resolveDrawRange(10, 6, true, 43)).toEqual({ startRow: 6, endRow: 11 })
  })

  it('a drag that stays on the anchor row is 15 minutes', () => {
    expect(resolveDrawRange(8, 8, true, 43)).toEqual({ startRow: 8, endRow: 9 })
  })

  it('does not run past the last row', () => {
    expect(resolveDrawRange(43, 43, false, 43)).toEqual({ startRow: 43, endRow: 44 })
    expect(resolveDrawRange(40, 50, true, 43)).toEqual({ startRow: 40, endRow: 44 })
  })
})

describe('assessHoldRange', () => {
  it('accepts an empty operational range', () => {
    const result = assessHoldRange({
      startRow: 0,
      endRow: 2,
      vehicleSlots: [],
      blockedBands: [],
      businessDay,
    })
    expect(result.ok).toBe(true)
    expect(result.startAt).toEqual(rowIndexToDate(0, businessDay))
    expect(result.endAt.getTime() - result.startAt.getTime()).toBe(30 * 60 * 1000)
  })

  it('rejects overlap with an existing slot', () => {
    const startAt = rowIndexToDate(4, businessDay)
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000)
    const result = assessHoldRange({
      startRow: 4,
      endRow: 6,
      vehicleSlots: [{ start_at: startAt.toISOString(), end_at: endAt.toISOString() }],
      blockedBands: [],
      businessDay,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('この時間にはすでに枠があります')
  })

  it('rejects a range that crosses a blocked band', () => {
    const result = assessHoldRange({
      startRow: 0,
      endRow: 4,
      vehicleSlots: [],
      blockedBands: [{ startRow: 2, endRow: 8 }],
      businessDay,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('稼働していない')
  })
})

describe('isUnfilledHold', () => {
  it('treats the hold placeholder and blank addresses as unfinished', () => {
    expect(isUnfilledHold({ pickup_address: HOLD_ADDRESS, dropoff_address: '駅' })).toBe(true)
    expect(isUnfilledHold({ pickup_address: '店', dropoff_address: '  ' })).toBe(true)
    expect(isUnfilledHold({ pickup_address: '店', dropoff_address: '駅' })).toBe(false)
  })
})
