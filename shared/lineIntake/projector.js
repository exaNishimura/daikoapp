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
