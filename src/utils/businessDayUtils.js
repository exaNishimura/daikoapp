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

const WORK_DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * YYYY-MM-DD をローカル Date（00:00）にする。不正なら null。
 */
export function parseWorkDateKey(dateStr) {
  const match = String(dateStr || '').match(WORK_DATE_KEY)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function addDaysToWorkDateKey(dateStr, days) {
  const date = parseWorkDateKey(dateStr)
  if (!date) return ''
  date.setDate(date.getDate() + Number(days) || 0)
  return formatWorkDateKey(date)
}

/**
 * 営業夜 D の 18:00〜翌 06:00。
 */
export function getNightRangeFromWorkDateKey(dateStr) {
  const date = parseWorkDateKey(dateStr)
  if (!date) return { start: null, end: null, businessDay: null }
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    BUSINESS_START_HOUR,
    0,
    0,
    0
  )
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    BUSINESS_END_HOUR,
    0,
    0,
    0
  )
  return { start, end, businessDay: date }
}

/**
 * 配車画面の date クエリ。当日より前は当営業夜に丸める。
 */
export function resolveDispatchNightKey(param, now = new Date()) {
  const current = formatWorkDateKey(getBusinessDayBoundaries(now).businessDay)
  const parsed = parseWorkDateKey(param)
  if (!parsed) return current
  const key = formatWorkDateKey(parsed)
  return key < current ? current : key
}

/**
 * 指定時刻が属する営業夜の YYYY-MM-DD（18:00 開始のその日）。
 * @param {string|Date} dateLike
 * @returns {string}
 */
export function getBusinessDayKey(dateLike = new Date()) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(date.getTime())) return ''
  return formatWorkDateKey(getBusinessDayBoundaries(date).businessDay)
}

/**
 * scheduled_at がその時点の配車画面（当営業夜）か。
 */
export function isCurrentBusinessNight(dateLike, now = new Date()) {
  const night = getBusinessDayKey(dateLike)
  return Boolean(night) && night === getBusinessDayKey(now)
}

/**
 * scheduled_at が現在の営業夜より後か（予約台帳行き）。
 */
export function isFutureBusinessNight(dateLike, now = new Date()) {
  const night = getBusinessDayKey(dateLike)
  return Boolean(night) && night > getBusinessDayKey(now)
}

/**
 * datetime-local 入力の min。営業日の開始（その夜 18:00）。
 * 0〜5 時は「前暦日 18:00」が現在の営業夜の開始。
 * @param {Date} reference - 基準時刻（デフォルトは現在）
 * @returns {string} "YYYY-MM-DDT18:00"
 */
export function getMinBusinessDateTime(reference = new Date()) {
  const { start } = getBusinessDayBoundaries(reference)
  const yyyy = start.getFullYear()
  const mm = String(start.getMonth() + 1).padStart(2, '0')
  const dd = String(start.getDate()).padStart(2, '0')
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
