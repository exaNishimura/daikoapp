/**
 * 集計シート (sheet name: "集計") のパーサー。
 *
 * シート構造（`excel-imports/_analysis-sales-full.txt` で実測）:
 *   - 行 0..2  : ヘッダ 3 行 (タイトル / 大ヘッダ / 中ヘッダ)
 *   - 行 3..33 : 日次データ (1日〜31日)
 *   - 行 34    : 空行
 *   - 行 35    : 合計行 (取り込み対象外、再計算する)
 *   - 行 36+   : 立替払い・燃費計算・月額経費・曜日別平均などのサマリ領域
 *               月額経費は AH/AI 列 (idx 33/34) に "label / 金額" の形で並ぶ
 *
 * 列マッピング:
 *   A= 0 日, B= 1 曜日
 *   C= 2 v1Dist, D= 3 v2Dist
 *   E= 4 v1Fuel, F= 5 v2Fuel
 *   G/H= 6/7 チョロモン (歩合制)
 *   I/J= 8/9 井上, K/L=10/11 伊藤, M/N=12/13 西村, O/P=14/15 たかし
 *   Q/R=16/17 しゅうや, S/T=18/19 山崎
 *   U/V=20/21 (現状未使用、将来 "臨時1" 用に確保)
 *   W/X=22/23 臨時 (実 Excel ヘッダは "臨時"、フッタは "臨時2")
 *   Y=24 売上計算チェック, Z=25 1号車売上, AA=26 2号車売上, AB=27 3号車売上
 *   AC=28 総売上, AD=29 のべ時間
 *   AF=31 売掛計
 *   AH=33 経費内容, AI=34 経費金額
 *   AK=36 現金, AL=37 収益/日
 */

import {
  parseAmount,
  parseDay,
  parseHours,
  parseKm,
} from './value-parsers'

/** 列インデックス定数 (0-indexed) */
export const COL = Object.freeze({
  day: 0,
  dow: 1,
  v1Dist: 2,
  v2Dist: 3,
  v1Fuel: 4,
  v2Fuel: 5,
  staff: Object.freeze([
    Object.freeze({ name: 'チョロモン', sales: 6, hours: 7 }),
    Object.freeze({ name: '井上', sales: 8, hours: 9 }),
    Object.freeze({ name: '伊藤', sales: 10, hours: 11 }),
    Object.freeze({ name: '西村', sales: 12, hours: 13 }),
    Object.freeze({ name: 'たかし', sales: 14, hours: 15 }),
    Object.freeze({ name: 'しゅうや', sales: 16, hours: 17 }),
    Object.freeze({ name: '山崎', sales: 18, hours: 19 }),
    Object.freeze({ name: '臨時1', sales: 20, hours: 21 }),
    Object.freeze({ name: '臨時2', sales: 22, hours: 23 }),
  ]),
  v1Sales: 25,
  v2Sales: 26,
  v3Sales: 27,
  totalSales: 28,
  totalHours: 29,
  receivableTotal: 31,
  expenseNote: 33,
  expenseAmount: 34,
  cash: 36,
  profit: 37,
})

/**
 * @typedef {Object} DailySaleRow
 * @property {Date}        workDate
 * @property {number|null} vehicle1DistanceKm
 * @property {number|null} vehicle2DistanceKm
 * @property {number|null} vehicle1FuelYen
 * @property {number|null} vehicle2FuelYen
 * @property {number}      vehicle1Sales
 * @property {number}      vehicle2Sales
 * @property {number}      vehicle3Sales
 * @property {number}      totalSales         (vehicle1+vehicle2+vehicle3、検算用)
 * @property {number}      totalHours
 * @property {number}      receivableTotal
 * @property {string|null} expenseNote
 * @property {number}      expenseAmount
 * @property {number}      cash
 * @property {number}      profit
 */

/**
 * @typedef {Object} StaffSaleRow
 * @property {Date}   workDate
 * @property {string} staffName
 * @property {number} sales
 * @property {number} hours
 */

/**
 * @typedef {Object} FixedExpenseRow
 * @property {string} label
 * @property {number} amount
 */

/**
 * @typedef {Object} ParseError
 * @property {string} sheet
 * @property {number} row    1-indexed for human readability
 * @property {string} field
 * @property {string} message
 */

/**
 * @typedef {Object} DailySheetResult
 * @property {DailySaleRow[]}    dailySales
 * @property {StaffSaleRow[]}    staffSales
 * @property {FixedExpenseRow[]} fixedExpenses
 * @property {ParseError[]}      errors
 */

/**
 * @param {Array<Array<unknown>>} rows  SheetJS sheet_to_json({header:1}) 形式
 * @param {{ year: number, month: number }} period
 * @returns {DailySheetResult}
 */
export function parseDailySheet(rows, period) {
  const errors = []
  const dailySales = []
  const staffSales = []
  const fixedExpenses = []
  const seenFixedLabels = new Map() // label -> count

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? []
    if (row.length === 0) continue

    const day = parseDay(row[COL.day])

    if (day != null) {
      // ===== 日次行 =====
      const workDate = makeWorkDate(period.year, period.month, day)
      if (!workDate) {
        errors.push({
          sheet: '集計',
          row: i + 1,
          field: 'day',
          message: `不正な日付 (year=${period.year} month=${period.month} day=${day})`,
        })
        continue
      }

      const v1Sales = parseAmount(row[COL.v1Sales]) ?? 0
      const v2Sales = parseAmount(row[COL.v2Sales]) ?? 0
      const v3Sales = parseAmount(row[COL.v3Sales]) ?? 0

      dailySales.push({
        workDate,
        vehicle1DistanceKm: parseKm(row[COL.v1Dist]),
        vehicle2DistanceKm: parseKm(row[COL.v2Dist]),
        vehicle1FuelYen: parseAmount(row[COL.v1Fuel]),
        vehicle2FuelYen: parseAmount(row[COL.v2Fuel]),
        vehicle1Sales: v1Sales,
        vehicle2Sales: v2Sales,
        vehicle3Sales: v3Sales,
        totalSales: parseAmount(row[COL.totalSales]) ?? v1Sales + v2Sales + v3Sales,
        totalHours: parseHours(row[COL.totalHours]) ?? 0,
        receivableTotal: parseAmount(row[COL.receivableTotal]) ?? 0,
        expenseNote: emptyToNull(row[COL.expenseNote]),
        expenseAmount: parseAmount(row[COL.expenseAmount]) ?? 0,
        cash: parseAmount(row[COL.cash]) ?? 0,
        profit: parseAmount(row[COL.profit]) ?? 0,
      })

      // ===== スタッフ別 =====
      for (const staff of COL.staff) {
        const sales = parseAmount(row[staff.sales])
        const hours = parseHours(row[staff.hours])
        // 売上 0 かつ 時間 0 の場合はレコード化しない (DB の容量節約)
        if ((sales ?? 0) === 0 && (hours ?? 0) === 0) continue
        staffSales.push({
          workDate,
          staffName: staff.name,
          sales: sales ?? 0,
          hours: hours ?? 0,
        })
      }
      continue
    }

    // ===== 月額固定経費行 (集計領域の AH/AI 列) =====
    // 日次行の経費 (内容/金額) と AH/AI を共有しているため、
    // 「row[0] が日として解釈不能」かつ「AH/AI に値あり」の行を月額経費とみなす。
    const label = stringOrNull(row[COL.expenseNote])
    const amount = parseAmount(row[COL.expenseAmount])
    if (label && amount != null) {
      const dedupedLabel = dedupeLabel(label, seenFixedLabels)
      // "小計" / "経費合計" のような集計ラベルは取り込まない。
      if (!isSummaryLabel(label)) {
        fixedExpenses.push({ label: dedupedLabel, amount })
      }
    }
  }

  return { dailySales, staffSales, fixedExpenses, errors }
}

/**
 * 同名ラベルがある場合は "_2", "_3" の suffix を付ける。
 * monthly_fixed_expenses の UNIQUE (billing_month, label) 制約を満たすため。
 */
function dedupeLabel(label, seen) {
  const count = (seen.get(label) ?? 0) + 1
  seen.set(label, count)
  return count === 1 ? label : `${label}_${count}`
}

const SUMMARY_LABELS = new Set(['小計', '経費合計', '合計'])
function isSummaryLabel(label) {
  return SUMMARY_LABELS.has(String(label).trim())
}

function stringOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

function emptyToNull(v) {
  return stringOrNull(v)
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day   1-31
 * @returns {Date | null}
 */
function makeWorkDate(year, month, day) {
  const d = new Date(year, month - 1, day)
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}
