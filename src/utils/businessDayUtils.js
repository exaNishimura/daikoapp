/**
 * 営業日・営業時間の計算ユーティリティ
 *
 * 本サービスは深夜帯営業（18:00 〜 翌 06:00）。営業日は
 * 「その日 18:00 〜 翌日 06:00」という単位で扱う。
 * 例: 2025-06-01 23:00 → 営業日 2025-06-01
 *     2025-06-02 03:00 → 営業日 2025-06-01（前日扱い）
 *     2025-06-02 12:00 → 営業時間外（昼）
 *
 * シフト表・売上の「営業当日」は日次締め（08:00）まで前日を維持する。
 * 例: 2025-06-02 07:59 → 営業当日 2025-06-01
 *     2025-06-02 08:00 → 営業当日 2025-06-02
 */

export const BUSINESS_START_HOUR = 18
export const BUSINESS_END_HOUR = 6
/** 日次締め時刻。これ未満はシフト表の営業当日を前日扱いにする */
export const SALES_CLOSE_HOUR = 8

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
 * シフト表・売上で使う「営業当日」を返す（日次締め 08:00 基準）。
 * カレンダー日付が変わっても、08:00 未満は前日を営業当日として扱う。
 * @param {Date} [reference=new Date()] - 基準時刻
 * @returns {Date} 年月日のみ意味あり（時刻は 00:00）
 */
export function getActiveWorkDate(reference = new Date()) {
  const workDate = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  if (reference.getHours() < SALES_CLOSE_HOUR) {
    workDate.setDate(workDate.getDate() - 1)
  }
  return workDate
}

/**
 * Date を 'YYYY-MM-DD' にフォーマット（ローカル日付）
 * @param {Date} date
 * @returns {string}
 */
export function formatWorkDateKey(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
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

/**
 * type="time" の値を HH:MM に正規化（iOS は HH:MM:SS を返すことがある）
 * @param {string} value
 * @returns {string}
 */
export function normalizeTimeInput(value) {
  if (value == null || value === '') return ''
  const match = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

/**
 * 日付と時刻を datetime-local 形式に結合し、15分刻みにスナップする
 * @param {string} date - "YYYY-MM-DD"
 * @param {string} time - "HH:MM" または "HH:MM:SS"
 * @returns {string} "YYYY-MM-DDTHH:MM"（未入力なら空文字）
 */
export function combineDateAndTime(date, time) {
  const normalizedTime = normalizeTimeInput(time)
  if (!date || !normalizedTime) return ''
  return snapDateTimeTo15Minutes(`${date}T${normalizedTime}`)
}
