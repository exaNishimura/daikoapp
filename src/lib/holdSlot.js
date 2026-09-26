import { hasTimeConflict } from '@/services/conflictDetectionService'
import { rowIndexToDate } from '@/utils/rowUtils'

/** 電話中に先に押さえる枠の出発地・目的地。この文字のままでは確定できない。 */
export const HOLD_ADDRESS = '未入力'

/** この移動量を超えたらスクロールを止めて範囲描画に切り替える。 */
export const DRAW_SLOP_PX = 8

/** タップ（ほとんど動かさず離す）で作る枠。15分×2 = 30分。 */
export const TAP_HOLD_ROWS = 2

export function isUnfilledHold(order) {
  const pickup = (order?.pickup_address || '').trim()
  const dropoff = (order?.dropoff_address || '').trim()
  return pickup === '' || pickup === HOLD_ADDRESS || dropoff === '' || dropoff === HOLD_ADDRESS
}

/**
 * アンカー行と現在行から枠の範囲を決める。endRow は含まない。
 * drawing が false のときはタップ扱いで TAP_HOLD_ROWS。
 */
export function resolveDrawRange(anchorRow, currentRow, drawing, lastRow) {
  const anchor = Math.max(0, Math.min(lastRow, anchorRow))
  const limit = lastRow + 1
  if (!drawing) {
    return { startRow: anchor, endRow: Math.min(limit, anchor + TAP_HOLD_ROWS) }
  }
  const current = Math.max(0, Math.min(lastRow, currentRow))
  const startRow = Math.min(anchor, current)
  return {
    startRow,
    endRow: Math.min(limit, Math.max(anchor, current) + 1),
  }
}

/**
 * 描いた範囲が既存枠・出勤前の帯と重ならないか。
 * @returns {{ ok: boolean, reason: string|null, startAt: Date, endAt: Date }}
 */
export function assessHoldRange({ startRow, endRow, vehicleSlots, blockedBands, businessDay }) {
  const startAt = rowIndexToDate(startRow, businessDay)
  const minutes = Math.max(0, endRow - startRow) * 15
  const endAt = new Date(startAt.getTime() + minutes * 60 * 1000)

  if (minutes < 15) {
    return { ok: false, reason: '枠を作れません', startAt, endAt }
  }

  const blocked = (blockedBands || []).some(
    (band) => startRow < band.endRow && endRow > band.startRow
  )
  if (blocked) {
    return {
      ok: false,
      reason: 'この時間帯は車両が稼働していないため配置できません。',
      startAt,
      endAt,
    }
  }

  const overlap = (vehicleSlots || []).some((slot) =>
    hasTimeConflict(startAt, endAt, new Date(slot.start_at), new Date(slot.end_at))
  )
  if (overlap) {
    return { ok: false, reason: 'この時間にはすでに枠があります', startAt, endAt }
  }

  return { ok: true, reason: null, startAt, endAt }
}

export function formatHoldRangeLabel(startAt, endAt) {
  const opts = { hour: '2-digit', minute: '2-digit' }
  const start = startAt.toLocaleTimeString('ja-JP', opts)
  const end = endAt.toLocaleTimeString('ja-JP', opts)
  return `${start}–${end}`
}
