/**
 * LINE 受注向けバッファ計算（Directions 所要に加算）
 * 現行 SPA `calculateBuffer` は一律 0 のため、LINE 可否判定は本式を使う。
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
