import { describe, it, expect } from 'vitest'
import { hasTimeConflict, checkSlotConflict } from './conflictDetectionService'

describe('hasTimeConflict', () => {
  const t = (h, m = 0) => new Date(2026, 5, 1, h, m)

  it('完全に分離している場合は競合なし', () => {
    expect(hasTimeConflict(t(20), t(21), t(22), t(23))).toBe(false)
  })
  it('一部重なる場合は競合', () => {
    expect(hasTimeConflict(t(20), t(22), t(21), t(23))).toBe(true)
  })
  it('片方が他方を完全に包含する場合は競合', () => {
    expect(hasTimeConflict(t(20), t(23), t(21), t(22))).toBe(true)
  })
  it('境界が一致する場合は競合扱いしない（end == start）', () => {
    expect(hasTimeConflict(t(20), t(21), t(21), t(22))).toBe(false)
  })
})

describe('checkSlotConflict', () => {
  const baseSlot = (overrides) => ({
    id: 'a',
    vehicle_id: 'v1',
    start_at: '2026-06-01T20:00:00Z',
    end_at: '2026-06-01T21:00:00Z',
    ...overrides,
  })

  it('車両IDが違う場合は競合扱いしない', () => {
    const a = baseSlot({ id: 'a', vehicle_id: 'v1' })
    const b = baseSlot({ id: 'b', vehicle_id: 'v2' })
    expect(checkSlotConflict(a, b)).toBe(false)
  })

  it('同一車両で時間が重なる場合は競合', () => {
    const a = baseSlot({ id: 'a' })
    const b = baseSlot({
      id: 'b',
      start_at: '2026-06-01T20:30:00Z',
      end_at: '2026-06-01T21:30:00Z',
    })
    expect(checkSlotConflict(a, b)).toBe(true)
  })
})
