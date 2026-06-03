/**
 * 日次売上の派生値 (total_sales, profit) と月次集計の計算。
 * すべて純関数 — DB 由来の値を入力として、表示用の数字を生む。
 *
 * DB スキーマで `total_sales` / `profit` は GENERATED ALWAYS AS STORED 列だが、
 * 入力中・未保存時のリアルタイム表示用にクライアント側でも同じ計算ロジックを持つ。
 */

import { calcStaffPayroll } from './calcStaffPayroll'

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
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
  const total_sales = n(row.vehicle1_sales) + n(row.vehicle2_sales) + n(row.vehicle3_sales)
  const fuel_total = n(row.vehicle1_fuel_yen) + n(row.vehicle2_fuel_yen)
  const profit = total_sales - n(row.expense_amount) - fuel_total
  return { total_sales, fuel_total, profit }
}

/**
 * 月次サマリ。
 *
 * 推定粗利 = 総売上 - 経費 - 燃料代 - スタッフ人件費 - 月額固定経費
 *
 * @param {Array} dailySales
 * @param {Array} staffSales
 * @param {Array} staffRates
 * @param {Array} fixedExpenses
 */
export function calcMonthlySalesSummary(
  dailySales = [],
  staffSales = [],
  staffRates = [],
  fixedExpenses = []
) {
  let total_sales = 0
  let receivable_total = 0
  let cash_total = 0
  let expense_total = 0
  let fuel_total = 0

  for (const row of Array.isArray(dailySales) ? dailySales : []) {
    const d = calcDailyDerived(row)
    total_sales += d.total_sales
    fuel_total += d.fuel_total
    receivable_total += n(row.receivable_total)
    cash_total += n(row.cash)
    expense_total += n(row.expense_amount)
  }

  const staff_payroll = calcStaffPayroll(staffSales, staffRates)
  const payroll_total = staff_payroll.reduce((s, p) => s + n(p.payroll), 0)

  const fixed_expense_total = (Array.isArray(fixedExpenses) ? fixedExpenses : []).reduce(
    (s, e) => s + n(e?.amount),
    0
  )

  const estimated_profit =
    total_sales - expense_total - fuel_total - payroll_total - fixed_expense_total

  return {
    total_sales,
    receivable_total,
    cash_total,
    expense_total,
    fuel_total,
    payroll_total,
    fixed_expense_total,
    estimated_profit,
    staff_payroll,
  }
}
