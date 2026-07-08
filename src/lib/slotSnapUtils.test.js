import { describe, expect, it } from 'vitest'
import { resolveSlotDropPreview } from './slotSnapUtils'

const order30 = { id: 'o1', base_duration_min: 30, buffer_min: 0 }

describe('resolveSlotDropPreview', () => {
  it('snaps top to peer bottom when within threshold (after)', () => {
    const result = resolveSlotDropPreview({
      rawTopPx: 163,
      dragHeightPx: 40,
      vehicleSlots: [
        {
          id: 'peer',
          order_id: 'o1',
          start_at: new Date(2025, 0, 1, 19, 30).toISOString(),
          end_at: new Date(2025, 0, 1, 20, 0).toISOString(),
        },
      ],
      orders: [order30],
      excludeSlotId: 'dragging',
    })

    expect(result.top).toBe(160)
    expect(result.snapGuide).toBe('top')
  })

  it('snaps before peer top when within threshold (before)', () => {
    const result = resolveSlotDropPreview({
      rawTopPx: 125,
      dragHeightPx: 40,
      vehicleSlots: [
        {
          id: 'peer',
          order_id: 'o1',
          start_at: new Date(2025, 0, 1, 20, 0).toISOString(),
          end_at: new Date(2025, 0, 1, 20, 30).toISOString(),
        },
      ],
      orders: [order30],
      excludeSlotId: 'dragging',
    })

    expect(result.top).toBe(120)
    expect(result.snapGuide).toBe('bottom')
  })

  it('excludes dragging slot from snap targets', () => {
    const result = resolveSlotDropPreview({
      rawTopPx: 120,
      dragHeightPx: 40,
      vehicleSlots: [
        {
          id: 'only',
          order_id: 'o1',
          start_at: new Date(2025, 0, 1, 19, 30).toISOString(),
          end_at: new Date(2025, 0, 1, 20, 0).toISOString(),
        },
      ],
      orders: [order30],
      excludeSlotId: 'only',
    })

    expect(result.snapGuide).toBe(null)
  })
})
