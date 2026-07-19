/**
 * 予約台帳の日時ウィンドウ（Edge / SPA 共用・外部依存なし）
 * タイムゾーンは Asia/Tokyo（UTC+9、DST なし）固定。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * @param {string} dateStr YYYY-MM-DD（JST 暦日）
 * @returns {{ y: number, month: number, d: number }}
 */
export function parseJstDateString(dateStr) {
  const m = DATE_RE.exec(String(dateStr ?? '').trim())
  if (!m) {
    throw new Error(`Invalid JST date string: ${dateStr}`)
  }
  const y = Number(m[1])
  const month = Number(m[2])
  const d = Number(m[3])
  // 実在日チェック（JS Date の正規化ずれを検出）
  const probe = new Date(Date.UTC(y, month - 1, d))
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date: ${dateStr}`)
  }
  return { y, month, d }
}

/**
 * JST 壁時計 → UTC Date
 * @param {number} y
 * @param {number} month 1-12
 * @param {number} d
 * @param {number} hour
 * @param {number} [minute=0]
 * @param {number} [second=0]
 * @param {number} [ms=0]
 */
export function jstWallToUtcDate(y, month, d, hour, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(y, month - 1, d, hour, minute, second, ms) - JST_OFFSET_MS)
}

/**
 * 受付開始付き営業夜ウィンドウ [D 19:00, (D+1) 06:00) Asia/Tokyo
 * @param {string} dateStr YYYY-MM-DD
 * @returns {{ start: Date, end: Date, startIso: string, endIso: string }}
 */
export function getReceptionNightWindow(dateStr) {
  const { y, month, d } = parseJstDateString(dateStr)
  const start = jstWallToUtcDate(y, month, d, 19, 0, 0, 0)
  // 翌日は Date.UTC 正規化で月/年跨ぎを吸収
  const next = new Date(Date.UTC(y, month - 1, d + 1))
  const end = jstWallToUtcDate(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    6,
    0,
    0,
    0
  )
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

/**
 * 暦日範囲 [D 00:00, (D+1) 00:00) Asia/Tokyo（台帳・シフト表）
 * @param {string} dateStr YYYY-MM-DD
 * @returns {{ start: Date, end: Date, startIso: string, endIso: string }}
 */
export function getCalendarDayRange(dateStr) {
  const { y, month, d } = parseJstDateString(dateStr)
  const start = jstWallToUtcDate(y, month, d, 0, 0, 0, 0)
  const next = new Date(Date.UTC(y, month - 1, d + 1))
  const end = jstWallToUtcDate(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    0,
    0
  )
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

/**
 * UTC 瞬間を Asia/Tokyo の YYYY-MM-DD にする
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function formatDateInJst(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
