/**
 * ホールド期限算出（Asia/Tokyo 壁時計）。
 * 営業時間内（電話受付開始 19:00 以降かつ営業ウィンドウ内）→ +15分
 * それ以外 → 次の 19:00
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const HOLD_MINUTES_IN_HOURS = 15
const PHONE_INTAKE_HOUR = 19
const BUSINESS_END_HOUR = 6

/**
 * @param {Date} date
 * @returns {{ y: number, month: number, d: number, hour: number, minute: number }}
 */
function toJstParts(date) {
  const jst = new Date(date.getTime() + JST_OFFSET_MS)
  return {
    y: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    d: jst.getUTCDate(),
    hour: jst.getUTCHours(),
    minute: jst.getUTCMinutes(),
  }
}

/**
 * JST 壁時計 → UTC Date
 */
function jstWallToUtc(y, month, d, hour, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(y, month - 1, d, hour, minute, second, ms) - JST_OFFSET_MS)
}

/**
 * createdAt が「19:00 以降の営業時間内」か
 * （hour >= 19 または hour < 6）
 * @param {Date} createdAt
 * @returns {boolean}
 */
export function isWithinPhoneIntakeHours(createdAt) {
  const { hour } = toJstParts(createdAt)
  return hour >= PHONE_INTAKE_HOUR || hour < BUSINESS_END_HOUR
}

/**
 * @param {Date|string|number} createdAt
 * @returns {Date}
 */
export function computeHoldUntil(createdAt) {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(created.getTime())) {
    throw new Error('Invalid createdAt')
  }

  if (isWithinPhoneIntakeHours(created)) {
    return new Date(created.getTime() + HOLD_MINUTES_IN_HOURS * 60 * 1000)
  }

  const parts = toJstParts(created)
  // 当日 19:00（まだ来ていなければ）。hour >= 6 かつ < 19 のときだけここに来る
  let y = parts.y
  let month = parts.month
  let d = parts.d
  if (parts.hour >= PHONE_INTAKE_HOUR) {
    // 理論上到達しないが安全側
    const next = new Date(Date.UTC(y, month - 1, d + 1))
    y = next.getUTCFullYear()
    month = next.getUTCMonth() + 1
    d = next.getUTCDate()
  }
  return jstWallToUtc(y, month, d, PHONE_INTAKE_HOUR, 0, 0, 0)
}
