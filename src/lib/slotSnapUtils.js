import {
  dateToRowIndex,
  dateToEndRowIndex,
  rowIndexToPixels,
  pixelsToRowIndex,
  snapToRowIndex,
  minutesToRows,
} from '@/utils/rowUtils'

/** スナップ判定のしきい値（px） */
export const SLOT_SNAP_THRESHOLD_PX = 12

const TIMELINE_HEIGHT_PX = 48 * 20

/**
 * 依頼のタイムライン上の高さ（px）を返す。
 */
export function getOrderDurationPixels(order) {
  const minutes = (order.base_duration_min || 30) + (order.buffer_min || 0)
  const rows = minutesToRows(minutes)
  return Math.max(rowIndexToPixels(rows), 20)
}

/**
 * スロットの画面上の top / height / bottom（px）を返す。
 */
export function getSlotBoundsPx(slot, order) {
  const startRow = dateToRowIndex(new Date(slot.start_at))
  const endRow = dateToEndRowIndex(new Date(slot.end_at))
  const actualRows = Math.max(1, endRow - startRow)
  const requiredRows = minutesToRows((order.base_duration_min || 30) + (order.buffer_min || 0))
  const rows = Math.max(actualRows, requiredRows)
  const top = rowIndexToPixels(startRow)
  const height = Math.max(rowIndexToPixels(rows), 20)
  return { top, height, bottom: top + height }
}

/**
 * 同一車両列の他スロット境界へスナップしたプレビュー位置を返す。
 *
 * @returns {{ top: number, height: number, snapGuide: 'top' | 'bottom' | null }}
 *   snapGuide: 'top' = 上端スナップ（上線）, 'bottom' = 下端スナップ（下線）
 */
export function resolveSlotDropPreview({
  rawTopPx,
  dragHeightPx,
  vehicleSlots,
  orders,
  excludeSlotId = null,
  snapThresholdPx = SLOT_SNAP_THRESHOLD_PX,
}) {
  const height = Math.max(dragHeightPx, 20)
  const rowSnappedTop = rowIndexToPixels(snapToRowIndex(pixelsToRowIndex(rawTopPx)))

  const peers = vehicleSlots
    .filter((s) => s.id !== excludeSlotId)
    .map((slot) => {
      const order = orders.find((o) => o.id === slot.order_id)
      if (!order) return null
      return getSlotBoundsPx(slot, order)
    })
    .filter(Boolean)

  let bestTop = rowSnappedTop
  let bestSnap = null
  let bestDistance = snapThresholdPx + 1

  const tryCandidate = (candidateTop, snapGuide, distance) => {
    const clampedTop = Math.max(0, Math.min(TIMELINE_HEIGHT_PX - height, candidateTop))
    if (distance <= snapThresholdPx && distance < bestDistance) {
      bestDistance = distance
      bestTop = clampedTop
      bestSnap = snapGuide
    }
  }

  for (const peer of peers) {
    // 既存カードの下端に上端を合わせる（直後に配置）
    const afterDistance = Math.abs(rowSnappedTop - peer.bottom)
    tryCandidate(peer.bottom, 'top', afterDistance)

    // 既存カードの上端に下端を合わせる（直前に配置）
    const beforeTop = peer.top - height
    const beforeDistance = Math.abs(rowSnappedTop - beforeTop)
    tryCandidate(beforeTop, 'bottom', beforeDistance)
  }

  if (bestSnap === null) {
    bestTop = Math.max(0, Math.min(TIMELINE_HEIGHT_PX - height, rowSnappedTop))
  }

  return {
    top: bestTop,
    height,
    snapGuide: bestSnap,
  }
}
