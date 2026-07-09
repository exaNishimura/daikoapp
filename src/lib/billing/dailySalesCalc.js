/**
 * 日次売上の派生値 (total_sales, profit) と月次集計の計算。
 * すべて純関数 — DB 由来の値を入力として、表示用の数字を生む。
 *
 * DB スキーマで `total_sales` / `profit` は GENERATED ALWAYS AS STORED 列だが、
 * 入力中・未保存時のリアルタイム表示用にクライアント側でも同じ計算ロジックを持つ。
 *
 * 2026-06: 3号車運用廃止 (2号車まで) と人件費(`labor_cost`) の日次管理に対応。
 * 旧 staff_rates × daily_staff_sales ベースの payroll 計算は廃止。
 */

import { getVehicleFieldKeys } from '@/lib/billing/vehicleSalesFields'

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/**
 * daily_sales.work_date / shifts.date を 'YYYY-MM-DD' に正規化する。
 * Supabase の DATE 型がタイムスタンプ付きで返る場合にも対応。
 */
export function toWorkDateKey(value) {
  if (value == null || value === '') return null
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * 日次売上配列を work_date キーの Map 相当オブジェクトへ。
 */
export function indexDailySalesByDate(rows) {
  const map = {}
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = toWorkDateKey(row?.work_date)
    if (key) map[key] = row
  }
  return map
}

/**
 * daily_sales 行から総売上を取得する。
 * DB の GENERATED 列 total_sales を優先し、未設定時は号車売上を合算する。
 */
export function getDailyTotalSales(row) {
  if (row == null) return 0
  if (row.total_sales != null && row.total_sales !== '') {
    return n(row.total_sales)
  }
  return n(row.vehicle1_sales) + n(row.vehicle2_sales)
}

/**
 * 日次の経費合計（号車別経費の合算）
 */
export function getExpenseTotal(row) {
  if (row == null) return 0
  return n(row.vehicle1_expense_amount) + n(row.vehicle2_expense_amount)
}

/**
 * 号車別の経費額
 */
export function getExpenseForVehicle(row, carNum) {
  const fields = getVehicleFieldKeys(carNum)
  if (!fields || row == null) return 0
  return n(row[fields.expense_amount])
}
/**
 * 1 行分の派生値を計算する。
 *
 * @param {Object|null} row daily_sales 行
 * @returns {{ total_sales: number, fuel_total: number, profit: number }}
 */
export function calcDailyDerived(row) {
  if (row == null) {
    return { total_sales: 0, fuel_total: 0, profit: 0 }
  }
  const total_sales = getDailyTotalSales(row)
  const fuel_total = n(row.vehicle1_fuel_yen) + n(row.vehicle2_fuel_yen)
  const expense_total = getExpenseTotal(row)
  const profit = total_sales - expense_total - fuel_total - n(row.labor_cost)
  return { total_sales, fuel_total, profit }
}

/**
 * シフト表入力ベースの現金 = 総売上 - 経費 - 燃料代 - 未収（売掛）
 */
export function computeCashFromShiftSales(row) {
  const total_sales = n(row?.vehicle1_sales) + n(row?.vehicle2_sales)
  const fuel_total = n(row?.vehicle1_fuel_yen) + n(row?.vehicle2_fuel_yen)
  const cash = total_sales - getExpenseTotal(row) - fuel_total - n(row?.receivable_total)
  return Math.max(0, Math.trunc(cash))
}

/**
 * 号車別の現金（集計結果表示用）。
 * 号車売上 - 号車燃料代 - 号車経費 - 号車売掛
 *
 * @param {Object|null} row daily_sales 行
 * @param {string|number} carNum 号車番号
 * @param {number} [receivableTotal=0] 当該号車の売掛合計
 */
export function computeCashForVehicle(row, carNum, receivableTotal = 0) {
  const fields = getVehicleFieldKeys(carNum)
  if (!fields || row == null) return 0

  const vehicle_sales = n(row[fields.sales])
  const vehicle_fuel = n(row[fields.fuel_yen])
  const vehicle_expense = n(row[fields.expense_amount])

  const cash = vehicle_sales - vehicle_fuel - vehicle_expense - n(receivableTotal)
  return Math.max(0, Math.trunc(cash))
}

/**
 * 月次サマリ。
 *
 * 推定粗利 = 総売上 - 経費 - 燃料代 - 人件費(日次合算) - 月額固定経費
 *
 * @param {Array} dailySales
 * @param {Array} fixedExpenses
 */
export function calcMonthlySalesSummary(dailySales = [], fixedExpenses = []) {
  let total_sales = 0
  let receivable_total = 0
  let cash_total = 0
  let expense_total = 0
  let fuel_total = 0
  let labor_cost_total = 0

  for (const row of Array.isArray(dailySales) ? dailySales : []) {
    const d = calcDailyDerived(row)
    total_sales += d.total_sales
    fuel_total += d.fuel_total
    receivable_total += n(row.receivable_total)
    cash_total += n(row.cash)
    expense_total += getExpenseTotal(row)
    labor_cost_total += n(row.labor_cost)
  }

  const fixed_expense_total = (Array.isArray(fixedExpenses) ? fixedExpenses : []).reduce(
    (s, e) => s + n(e?.amount),
    0
  )

  const estimated_profit =
    total_sales - expense_total - fuel_total - labor_cost_total - fixed_expense_total

  return {
    total_sales,
    receivable_total,
    cash_total,
    expense_total,
    fuel_total,
    labor_cost_total,
    fixed_expense_total,
    estimated_profit,
  }
}
