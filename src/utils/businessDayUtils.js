/**
 * 営業日・営業時間の計算ユーティリティ
 *
 * 本サービスは深夜帯営業（18:00 〜 翌 06:00）。営業日は
 * 「その日 18:00 〜 翌日 06:00」という単位で扱う。
 * 例: 2025-06-01 23:00 → 営業日 2025-06-01
 *     2025-06-02 03:00 → 営業日 2025-06-01（前日扱い）
 *     2025-06-02 12:00 → 営業時間外（昼）
 */

export const BUSINESS_START_HOUR = 18
export const BUSINESS_END_HOUR = 6

/**
 * 指定時刻が営業時間内（18:00 以降または 06:00 未満）かを判定
 * @param {string|Date} dateLike - 判定対象の日時
 * @returns {boolean}
 */
export function isWithinBusinessHours(dateLike) {
  if (!dateLike) return false
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(date.getTime())) return false
  const hours = date.getHours()
  return hours >= BUSINESS_START_HOUR || hours < BUSINESS_END_HOUR
}

/**
 * 指定時刻が属する営業日の開始/終了時刻を返す
 * @param {Date} reference - 基準時刻（デフォルトは現在）
 * @returns {{ start: Date, end: Date, businessDay: Date }}
 *  - businessDay: 営業日の 00:00（年月日のみ意味あり）
 *  - start: businessDay の 18:00
 *  - end: businessDay の翌日 06:00
 */
export function getBusinessDayBoundaries(reference = new Date()) {
  const localDate = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())

  const businessDay = new Date(localDate)
  if (reference.getHours() < BUSINESS_END_HOUR) {
    businessDay.setDate(businessDay.getDate() - 1)
  }

  const start = new Date(
    businessDay.getFullYear(),
    businessDay.getMonth(),
    businessDay.getDate(),
    BUSINESS_START_HOUR,
    0,
    0,
    0
  )
  const end = new Date(
    businessDay.getFullYear(),
    businessDay.getMonth(),
    businessDay.getDate() + 1,
    BUSINESS_END_HOUR,
    0,
    0,
    0
  )

  return { start, end, businessDay }
}

/**
 * 現在時刻を 15 分刻みにスナップして datetime-local 形式の文字列で返す
 * @returns {string} "YYYY-MM-DDTHH:MM"
 */
export function getCurrentDateTimeLocal() {
  const now = new Date()
  const minutes = Math.round(now.getMinutes() / 15) * 15
  const snapped = new Date(now)
  snapped.setMinutes(minutes, 0, 0)

  const yyyy = snapped.getFullYear()
  const mm = String(snapped.getMonth() + 1).padStart(2, '0')
  const dd = String(snapped.getDate()).padStart(2, '0')
  const hh = String(snapped.getHours()).padStart(2, '0')
  const mi = String(snapped.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

/**
 * datetime-local 入力の min 属性に渡す「当日 18:00」の文字列
 * @param {Date} reference - 基準時刻（デフォルトは現在）
 * @returns {string} "YYYY-MM-DDT18:00"
 */
export function getMinBusinessDateTime(reference = new Date()) {
  const yyyy = reference.getFullYear()
  const mm = String(reference.getMonth() + 1).padStart(2, '0')
  const dd = String(reference.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${String(BUSINESS_START_HOUR).padStart(2, '0')}:00`
}

/**
 * datetime-local 文字列を 15 分刻みにスナップ
 * @param {string} dateTimeString - "YYYY-MM-DDTHH:MM" 形式（空文字や falsy はそのまま返す）
 * @returns {string} スナップ後の "YYYY-MM-DDTHH:MM"
 */
export function snapDateTimeTo15Minutes(dateTimeString) {
  if (!dateTimeString) return dateTimeString
  const date = new Date(dateTimeString)
  if (Number.isNaN(date.getTime())) return dateTimeString

  const snapped = new Date(date)
  snapped.setMinutes(Math.round(date.getMinutes() / 15) * 15, 0, 0)

  const yyyy = snapped.getFullYear()
  const mm = String(snapped.getMonth() + 1).padStart(2, '0')
  const dd = String(snapped.getDate()).padStart(2, '0')
  const hh = String(snapped.getHours()).padStart(2, '0')
  const mi = String(snapped.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}
