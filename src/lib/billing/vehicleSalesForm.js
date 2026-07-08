import {
  buildDailySalesUpsertPayload,
  readVehicleFormFromRow,
} from '@/lib/billing/vehicleSalesFields'
import {
  buildShiftTimeRows,
  computeDayStaffHoursRows,
  computeDayTotalHours,
  computeLaborCostFromStaffHours,
  buildShiftUpdatePayloads,
} from '@/lib/billing/shiftStaffHours'
import { computeCashFromShiftSales } from '@/lib/billing/dailySalesCalc'
import { toShiftReceivableFormLines } from '@/lib/billing/shiftReceivables'

function parseInt0OrZero(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

function nullableText(v) {
  if (v == null || v === '') return null
  return String(v)
}

/**
 * モーダル初期フォーム
 */
export function readVehicleSalesForm({
  dailyRow,
  carNum,
  dayShifts,
  employees,
  savedStaffRows,
  receivableRows = [],
}) {
  return {
    ...readVehicleFormFromRow(dailyRow, carNum),
    shiftTimes: buildShiftTimeRows(dayShifts, employees, carNum),
    expense_note: dailyRow?.expense_note ?? '',
    expense_amount: dailyRow?.expense_amount ?? '',
    receivables: toShiftReceivableFormLines(receivableRows, carNum),
  }
}

/**
 * daily_sales + daily_staff_sales 保存用ペイロード
 */
export function buildVehicleSalesSavePayload({
  workDate,
  existingRow,
  carNum,
  form,
  dayShifts = [],
  employees = [],
  existingStaffRows = [],
  receivableTotal = 0,
}) {
  const dailyPayload = buildDailySalesUpsertPayload(workDate, existingRow, carNum, form)
  dailyPayload.expense_note = nullableText(form.expense_note)
  dailyPayload.expense_amount = parseInt0OrZero(form.expense_amount)
  dailyPayload.receivable_total = parseInt0OrZero(receivableTotal)

  const shiftUpdates = buildShiftUpdatePayloads(form.shiftTimes, dayShifts)

  const dayStaffHoursRows = computeDayStaffHoursRows({
    dayShifts,
    employees,
    shiftTimeUpdates: form.shiftTimes,
  })

  dailyPayload.total_hours = computeDayTotalHours({
    dayShifts,
    employees,
    shiftTimeUpdates: form.shiftTimes,
  })
  dailyPayload.labor_cost = computeLaborCostFromStaffHours(dayStaffHoursRows, employees)
  dailyPayload.cash = computeCashFromShiftSales(dailyPayload)

  const existingSalesByName = new Map(
    (existingStaffRows ?? []).map((r) => [r.staff_name, r.sales ?? 0])
  )

  const staffRows = dayStaffHoursRows.map((row) => ({
    work_date: workDate,
    staff_name: row.staff_name,
    hours: row.hours,
    sales: existingSalesByName.get(row.staff_name) ?? 0,
  }))

  return { dailyPayload, staffRows, shiftUpdates }
}
