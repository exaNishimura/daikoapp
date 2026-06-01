/**
 * 「YYYYMM稼働管理表new.xlsx」全体のパーサー (純関数)。
 *
 * SheetJS で workbook を読み、シート名 "集計" と "売掛" を取り出して
 * それぞれ `parseDailySheet` / `parseReceivablesSheet` に流す。
 *
 * 入力:
 *   - file: ArrayBuffer | Uint8Array | Buffer
 *   - fileName: 元ファイル名 (年月抽出用、source_file 記録用)
 *
 * 出力 (ParseResult):
 *   - period          : { year, month }
 *   - dailySales      : DailySaleRow[]
 *   - staffSales      : StaffSaleRow[]
 *   - receivables     : ReceivableRow[]
 *   - fixedExpenses   : FixedExpenseRow[]
 *   - seenCompanies   : Set<string>
 *   - errors          : ParseError[]
 *   - sourceFile      : string
 */

import * as XLSX from 'xlsx'
import { parsePeriodFromFileName } from './value-parsers'
import { parseDailySheet } from './parseDailySheet'
import { parseReceivablesSheet } from './parseReceivablesSheet'

const SHEET_DAILY = '集計'
const SHEET_RECEIVABLES = '売掛'

/**
 * @typedef {Object} ParseResult
 * @property {{ year: number, month: number } | null} period
 * @property {import('./parseDailySheet').DailySaleRow[]} dailySales
 * @property {import('./parseDailySheet').StaffSaleRow[]} staffSales
 * @property {import('./parseReceivablesSheet').ReceivableRow[]} receivables
 * @property {import('./parseDailySheet').FixedExpenseRow[]} fixedExpenses
 * @property {Set<string>} seenCompanies
 * @property {import('./parseDailySheet').ParseError[]} errors
 * @property {string} sourceFile
 */

/**
 * @param {ArrayBuffer | Uint8Array | Buffer} file
 * @param {string} fileName
 * @returns {ParseResult}
 */
export function parseSalesWorkbook(file, fileName) {
  /** @type {ParseResult} */
  const result = {
    period: null,
    dailySales: [],
    staffSales: [],
    receivables: [],
    fixedExpenses: [],
    seenCompanies: new Set(),
    errors: [],
    sourceFile: fileName ?? '',
  }

  const period = parsePeriodFromFileName(fileName)
  if (!period) {
    result.errors.push({
      sheet: '(filename)',
      row: 0,
      field: 'fileName',
      message: `ファイル名から年月を抽出できません (${fileName})。"YYYYMM稼働管理表" 形式が必要。`,
    })
    return result
  }
  result.period = period

  let workbook
  try {
    workbook = XLSX.read(file, { type: 'array', cellDates: false })
  } catch (e) {
    result.errors.push({
      sheet: '(workbook)',
      row: 0,
      field: 'file',
      message: `ワークブックの読み込みに失敗: ${e?.message ?? e}`,
    })
    return result
  }

  // ===== "集計" シート =====
  const dailySheet = workbook.Sheets[SHEET_DAILY]
  if (!dailySheet) {
    result.errors.push({
      sheet: SHEET_DAILY,
      row: 0,
      field: 'sheetName',
      message: `シート "${SHEET_DAILY}" が見つかりません`,
    })
  } else {
    const rows = XLSX.utils.sheet_to_json(dailySheet, { header: 1, defval: '' })
    const r = parseDailySheet(rows, period)
    result.dailySales = r.dailySales
    result.staffSales = r.staffSales
    result.fixedExpenses = r.fixedExpenses
    result.errors.push(...r.errors)
  }

  // ===== "売掛" シート =====
  const receivablesSheet = workbook.Sheets[SHEET_RECEIVABLES]
  if (!receivablesSheet) {
    result.errors.push({
      sheet: SHEET_RECEIVABLES,
      row: 0,
      field: 'sheetName',
      message: `シート "${SHEET_RECEIVABLES}" が見つかりません`,
    })
  } else {
    const rows = XLSX.utils.sheet_to_json(receivablesSheet, { header: 1, defval: '' })
    const r = parseReceivablesSheet(rows, period)
    result.receivables = r.receivables
    result.seenCompanies = r.seenCompanies
    result.errors.push(...r.errors)
  }

  return result
}
