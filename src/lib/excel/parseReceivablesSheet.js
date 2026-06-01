/**
 * 売掛シート (sheet name: "売掛") のパーサー。
 *
 * シート構造（`excel-imports/_analysis-sales-full.txt` で実測）:
 *   - range は B3:I90 だが SheetJS が返す配列は left-trim されて 0 列目が "B" 列に対応する。
 *   - rows[0]      = タイトル行  ["YYYY年M月売掛記録", "", "", "", "合計¥XXX,XXX", "OK", "合計¥0"]
 *   - rows[1]      = ヘッダ行    ["請求先","日","出発地","到着地","金額","備考"]
 *   - rows[2..]    = 明細データ。企業ごとにブロック化、空行で区切り。
 *                    ・「企業名のみ」の行 (日も金額も無い) はスキップしつつ
 *                       その企業を seenCompanies にだけ記録 (取引先存在の signal)。
 *
 * 列マッピング (0-indexed in SheetJS で B 列が 0):
 *   0 = 請求先 (B)
 *   1 = 日   "5日"  (C)
 *   2 = 出発地 (D)
 *   3 = 到着地 (E)
 *   4 = 金額 "¥X,XXX" (F)
 *   5 = 備考 (G)
 *   6 = OK / "合計¥..." 等のチェック領域 (H, I) — データには関係しない
 */

import { parseAmount, parseDay } from './value-parsers'

/** 列インデックス (B 列 = 0 として) */
export const RC_COL = Object.freeze({
  companyName: 0,
  day: 1,
  departure: 2,
  destination: 3,
  amount: 4,
  note: 5,
})

/**
 * @typedef {Object} ReceivableRow
 * @property {string}      companyName
 * @property {Date}        workDate
 * @property {string|null} departure
 * @property {string|null} destination
 * @property {number}      amount
 * @property {string|null} note
 */

/**
 * @typedef {Object} ParseError
 * @property {string} sheet
 * @property {number} row
 * @property {string} field
 * @property {string} message
 */

/**
 * @typedef {Object} ReceivablesSheetResult
 * @property {ReceivableRow[]}   receivables
 * @property {Set<string>}       seenCompanies   (空ブロックも含めて登場した企業名)
 * @property {ParseError[]}      errors
 */

/**
 * @param {Array<Array<unknown>>} rows  SheetJS の sheet_to_json({header:1}) 結果
 * @param {{ year: number, month: number }} period
 * @returns {ReceivablesSheetResult}
 */
export function parseReceivablesSheet(rows, period) {
  const receivables = []
  const seenCompanies = new Set()
  const errors = []

  // ヘッダ 2 行 (タイトル + 列ヘッダ) をスキップ。
  // 万一タイトルが省略されたシートにも対応するため、ヘッダ行検出ロジックも入れる。
  const dataStart = findDataStart(rows)
  let currentCompany = null

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? []
    if (isAllEmpty(row)) {
      currentCompany = null
      continue
    }

    const name = stringOrNull(row[RC_COL.companyName])
    if (name) {
      currentCompany = name
      seenCompanies.add(name)
    }

    const day = parseDay(row[RC_COL.day])
    const amount = parseAmount(row[RC_COL.amount])

    // 企業名のみ並んでる行 (その月に該当企業の依頼ゼロ) はスキップ。
    if (day == null || amount == null) continue

    if (!currentCompany) {
      errors.push({
        sheet: '売掛',
        row: i + 1,
        field: 'companyName',
        message: '企業名が特定できない明細行',
      })
      continue
    }

    const workDate = makeDate(period.year, period.month, day)
    if (!workDate) {
      errors.push({
        sheet: '売掛',
        row: i + 1,
        field: 'day',
        message: `不正な日付 (year=${period.year} month=${period.month} day=${day})`,
      })
      continue
    }

    receivables.push({
      companyName: currentCompany,
      workDate,
      departure: stringOrNull(row[RC_COL.departure]),
      destination: stringOrNull(row[RC_COL.destination]),
      amount,
      note: stringOrNull(row[RC_COL.note]),
    })
  }

  return { receivables, seenCompanies, errors }
}

/**
 * ヘッダ行 (請求先 / 日 / 出発地 / ...) の直下を返す。
 * ヘッダが見つからなければ 0 を返す (このシートが想定外フォーマット)。
 */
function findDataStart(rows) {
  const HEADER_KEYS = ['請求先', '請求', '取引先']
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cell = stringOrNull(rows[i]?.[RC_COL.companyName])
    if (cell && HEADER_KEYS.some((k) => cell.includes(k))) {
      return i + 1
    }
  }
  // フォールバック: 最初の 2 行 (タイトル + ヘッダ) をスキップ。
  return 2
}

function isAllEmpty(row) {
  if (!row || row.length === 0) return true
  return row.every((c) => c == null || String(c).trim() === '')
}

function stringOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

function makeDate(year, month, day) {
  const d = new Date(year, month - 1, day)
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}
