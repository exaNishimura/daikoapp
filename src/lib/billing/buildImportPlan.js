/**
 * `parseSalesWorkbook` の結果 (camelCase) + UI で決定した
 * { companyMap, duplicates, strategy } を、`bulk_import_receivables` RPC が
 * 期待する snake_case ペイロードに変換する純関数。
 *
 * 出力:
 *   {
 *     period:                  'YYYY-MM-01'
 *     source_file:             string
 *     daily_sales:             { work_date, vehicle1_distance_km, ... }[]
 *     staff_sales:             { work_date, staff_name, sales, hours }[]
 *     receivables:             { billing_month, company_id, work_date, departure,
 *                                destination, amount, note }[]
 *     fixed_expenses:          { billing_month, label, amount }[]
 *     skipped_receivables:     number  (companyMap に無い行数)
 *     duplicate_count:         number  (duplicates Set で除外された数)
 *     summary:                 { daily_count, staff_count, receivable_count,
 *                                fixed_count, unmapped_companies, duplicate_count }
 *   }
 */

import { receivableKey } from './duplicateReceivables'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function dateOnly(d) {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

function nullable(v) {
  return v == null || v === '' ? null : v
}

export function buildImportPlan(parsed, { companyMap = {}, duplicates = new Set() } = {}) {
  if (!parsed?.period) {
    throw new Error('buildImportPlan: parsed.period is required')
  }
  const period = `${parsed.period.year}-${pad2(parsed.period.month)}-01`

  const daily_sales = (parsed.dailySales ?? []).map((r) => ({
    work_date: dateOnly(r.workDate),
    vehicle1_distance_km: r.vehicle1DistanceKm ?? null,
    vehicle2_distance_km: r.vehicle2DistanceKm ?? null,
    vehicle1_fuel_yen: r.vehicle1FuelYen ?? null,
    vehicle2_fuel_yen: r.vehicle2FuelYen ?? null,
    vehicle1_sales: r.vehicle1Sales ?? 0,
    vehicle2_sales: r.vehicle2Sales ?? 0,
    total_hours: r.totalHours ?? 0,
    receivable_total: r.receivableTotal ?? 0,
    vehicle1_expense_note: nullable(r.expenseNote),
    vehicle1_expense_amount: r.expenseAmount ?? 0,
    vehicle2_expense_note: null,
    vehicle2_expense_amount: 0,
    labor_cost: r.laborCost ?? 0,
    cash: r.cash ?? 0,
  }))

  const staff_sales = (parsed.staffSales ?? []).map((r) => ({
    work_date: dateOnly(r.workDate),
    staff_name: r.staffName,
    sales: r.sales ?? 0,
    hours: r.hours ?? 0,
  }))

  let skipped_receivables = 0
  let duplicate_count = 0
  const receivables = []
  for (const r of parsed.receivables ?? []) {
    const company_id = companyMap[r.companyName]
    if (!company_id) {
      skipped_receivables += 1
      continue
    }
    const payload = {
      billing_month: period,
      company_id,
      work_date: dateOnly(r.workDate),
      departure: nullable(r.departure),
      destination: nullable(r.destination),
      amount: r.amount,
      note: nullable(r.note),
    }
    if (duplicates.has(receivableKey(payload))) {
      duplicate_count += 1
      continue
    }
    receivables.push(payload)
  }

  const fixed_expenses = (parsed.fixedExpenses ?? []).map((r) => ({
    billing_month: period,
    label: r.label,
    amount: r.amount ?? 0,
  }))

  return {
    period,
    source_file: parsed.sourceFile ?? '',
    daily_sales,
    staff_sales,
    receivables,
    fixed_expenses,
    skipped_receivables,
    duplicate_count,
    summary: {
      daily_count: daily_sales.length,
      staff_count: staff_sales.length,
      receivable_count: receivables.length,
      fixed_count: fixed_expenses.length,
      unmapped_companies: skipped_receivables,
      duplicate_count,
    },
  }
}
