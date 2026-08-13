/**
 * Excel セル値の文字列表記から JS 値へのパーサー群（純関数）。
 *
 * 入力 Excel の表記（`excel-imports/_analysis-sales-full.txt` 参照）:
 *   - 金額: "¥41,000" / "¥27,000-" / "¥-6,400"（マイナスは表記上のみ、実際は空運営日のオフセット表示）
 *   - 距離: "175km"
 *   - 時間: "9.50h"
 *   - 日 : "5日"
 *   - 日付: "2026年5月31日"
 *
 * すべての関数は失敗時に null を返す（throw しない）。空文字・null・undefined も null。
 */

/**
 * "¥41,000" や "¥27,000-" や 41000 を整数 yen に変換する。
 * - 通貨記号 / カンマ / 末尾のハイフン / 前後空白を除去
 * - 既に number ならそのまま整数化
 * - 空 / null / undefined / NaN は null
 *
 * 注意: "¥-6,400" のような負号付きはマイナス値として扱う。
 *
 * @param {unknown} input
 * @returns {number | null}
 */
export function parseAmount(input) {
  if (input == null) return null
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.trunc(input) : null
  }
  const raw = String(input).trim()
  if (!raw) return null

  // 末尾のみのハイフン（"¥27,000-" 形式）は単なる装飾、除去する。
  // ただし先頭の "-" はマイナス符号として温存する。
  let s = raw.replace(/[¥￥,\s]/g, '')
  if (s.endsWith('-') && !s.startsWith('-')) {
    s = s.slice(0, -1)
  }
  if (s === '' || s === '-') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/**
 * "175km" を 175 (数値) に変換する。
 * @param {unknown} input
 * @returns {number | null}
 */
export function parseKm(input) {
  if (input == null) return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  const raw = String(input).trim()
  if (!raw) return null
  const m = raw.replace(/[,\s]/g, '').replace(/km$/i, '')
  if (!m) return null
  const n = Number(m)
  return Number.isFinite(n) ? n : null
}

/**
 * "9.50h" を 9.5 に変換する。
 * @param {unknown} input
 * @returns {number | null}
 */
export function parseHours(input) {
  if (input == null) return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  const raw = String(input).trim()
  if (!raw) return null
  const m = raw.replace(/[,\s]/g, '').replace(/h$/i, '')
  if (!m) return null
  const n = Number(m)
  return Number.isFinite(n) ? n : null
}

/**
 * "5日" を 5 に変換する。Date / number もそのまま受け付ける。
 *
 * Excel のセルが「日付」として書式設定されている場合、SheetJS は cellDates:true
 * オプション付きで Date オブジェクトを返す。`5日` 表示でも内部的には Excel
 * シリアル日付になっているケースがあるので、Date を渡された場合は getDate() を返す。
 *
 * @param {unknown} input
 * @returns {number | null}
 */
export function parseDay(input) {
  if (input == null) return null
  if (input instanceof Date) {
    if (!Number.isFinite(input.getTime())) return null
    return input.getDate()
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null
    const day = Math.trunc(input)
    if (day >= 1 && day <= 31) return day
    // 1-31 範囲外の数値は Excel 日付シリアルとみなす (cellDates 未指定時の保険)。
    return excelSerialToDay(day)
  }
  const raw = String(input).trim()
  if (!raw) return null
  const m = raw.replace(/日\s*$/, '').replace(/[,\s]/g, '')
  if (!m) return null
  const n = Number(m)
  if (!Number.isFinite(n)) return null
  const day = Math.trunc(n)
  if (day >= 1 && day <= 31) return day
  return excelSerialToDay(day)
}

/**
 * Excel 日付シリアル番号 (1900-01-01 を 1 とする、1900 閏年バグあり) を
 * JS Date に変換し、その day-of-month を返す。範囲外なら null。
 *
 * Excel の epoch は 1899-12-30 (UTC) として扱うのが慣例 (1900 閏年バグ補正)。
 *
 * @param {number} serial
 * @returns {number | null}
 */
function excelSerialToDay(serial) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) return null
  const epochMs = Date.UTC(1899, 11, 30)
  const dt = new Date(epochMs + serial * 86400 * 1000)
  if (!Number.isFinite(dt.getTime())) return null
  return dt.getUTCDate()
}

/**
 * "2026年5月31日" や "2026/5/31" などを Date に変換する。
 * - Date が渡されたらそのまま返す
 * - パース失敗時は null
 *
 * @param {unknown} input
 * @returns {Date | null}
 */
export function parseJpDate(input) {
  if (input == null) return null
  if (input instanceof Date) {
    return Number.isFinite(input.getTime()) ? input : null
  }
  const raw = String(input).trim()
  if (!raw) return null

  // "2026年5月31日" / "2026年05月31日"
  const jp = raw.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
  if (jp) {
    const [, y, m, d] = jp
    return makeDate(Number(y), Number(m), Number(d))
  }
  // "2026/5/31" / "2026-5-31"
  const iso = raw.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (iso) {
    const [, y, m, d] = iso
    return makeDate(Number(y), Number(m), Number(d))
  }
  // フォールバック: Date のネイティブパース
  const t = Date.parse(raw)
  return Number.isFinite(t) ? new Date(t) : null
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day   1-31
 * @returns {Date | null}
 */
function makeDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // ローカルタイムゾーンの 00:00 を作る。Excel データは日本時間想定。
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null
  }
  return dt
}

/**
 * "202605稼働管理表new.xlsx" のようなファイル名から年月を抽出する。
 * @param {string} fileName
 * @returns {{ year: number, month: number } | null}
 */
export function parsePeriodFromFileName(fileName) {
  if (!fileName) return null
  const m = String(fileName).match(/(\d{4})(\d{2})稼働管理表/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month }
}
