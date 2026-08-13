import { describe, expect, it } from 'vitest'
import { rowIndexToPixels, timeToRowIndex, TIMELINE_ROW_HEIGHT_PX } from '@/utils/rowUtils'
import { resolveSlotDropPreview } from './slotSnapUtils'

const order30 = { id: 'o1', base_duration_min: 30, buffer_min: 0 }

describe('resolveSlotDropPreview', () => {
  it('snaps top to peer bottom when within threshold (after)', () => {
    const peerBottom = rowIndexToPixels(timeToRowIndex(20, 0))
    const result = resolveSlotDropPreview({
      rawTopPx: peerBottom + 6,
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

    expect(result.top).toBe(peerBottom)
    expect(result.snapGuide).toBe('top')
  })

  it('snaps before peer top when within threshold (before)', () => {
    const peerTop = rowIndexToPixels(timeToRowIndex(20, 0))
    const dragHeightPx = 40
    const beforeTop = peerTop - Math.max(dragHeightPx, TIMELINE_ROW_HEIGHT_PX)
    const result = resolveSlotDropPreview({
      rawTopPx: beforeTop + 4,
      dragHeightPx,
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

    expect(result.top).toBe(beforeTop)
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
