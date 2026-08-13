/**
 * 当日 → 配車ボード系 / 非当日 → 予約台帳系
 */

import { getLineBusinessDayKey } from './availability.js'

/**
 * @param {Date|string} pickupAt
 * @param {Date|string} [now]
 * @returns {'BOARD'|'LEDGER'}
 */
export function resolveProjectionTarget(pickupAt, now = new Date()) {
  const pickup = pickupAt instanceof Date ? pickupAt : new Date(pickupAt)
  const reference = now instanceof Date ? now : new Date(now)
  const pickupDay = getLineBusinessDayKey(pickup)
  const today = getLineBusinessDayKey(reference)
  return pickupDay === today ? 'BOARD' : 'LEDGER'
}

/** 配車ボードのルート未計算時と同じ仮値（`orderSubmission` DEFAULT_DURATION_MIN） */
export const DISPATCH_FALLBACK_DURATION_MIN = 30

/**
 * LINE 台の Maps 所要を配車 `orders` 向けに正規化する。
 * 配車 SPA の `calculateBuffer` は一律 0。LINE 可否用バッファは orders に載せない。
 * @param {{ base_duration_min?: number|null }} unit
 * @returns {{ base_duration_min: number, buffer_min: number }}
 */
export function toBoardRouteFields(unit) {
  const base = Number(unit?.base_duration_min)
  return {
    base_duration_min: Number.isFinite(base) && base > 0 ? Math.round(base) : DISPATCH_FALLBACK_DURATION_MIN,
    buffer_min: 0,
  }
}

/**
 * orders / reservations へ載せる識別用メモ断片
 * @param {{ lineUserId: string, unitId: string, discountLabel?: string }} meta
 */
export function buildLineChannelMarkers(meta) {
  return {
    channel: 'LINE',
    line_user_id: meta.lineUserId,
    line_unit_id: meta.unitId,
    memo_prefix: `[LINE] user=${meta.lineUserId} unit=${meta.unitId}${
      meta.discountLabel ? ` ${meta.discountLabel}` : ''
    }`,
  }
}
