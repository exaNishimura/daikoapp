/** 配車 orders に載せる初期バッファ。SPA `calculateBuffer` と同じ 10 分。 */
export const DISPATCH_BUFFER_MIN = 10

/**
 * LINE 受注向けバッファ計算（Directions 所要に加算）
 * 配車の初期値とは別。可否判定だけ本式を使い、orders には載せない。
 *
 * @param {number|null|undefined} baseDurationMinutes
 * @returns {number}
 */
export function calculateLineBuffer(baseDurationMinutes) {
  const base = Number(baseDurationMinutes)
  const safeBase = Number.isFinite(base) && base > 0 ? base : 20
  const pickupWait = 5
  const baseBuffer = Math.max(5, Math.ceil(safeBase * 0.15))
  return baseBuffer + pickupWait
}

/**
 * @param {number|null|undefined} baseDurationMinutes
 * @returns {number} base + buffer
 */
export function totalDurationWithBuffer(baseDurationMinutes) {
  const base = Number(baseDurationMinutes)
  const safeBase = Number.isFinite(base) && base > 0 ? base : 20
  return safeBase + calculateLineBuffer(safeBase)
}
