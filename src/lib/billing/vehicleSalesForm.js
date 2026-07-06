import {
  buildDailySalesUpsertPayload,
  readVehicleFormFromRow,
} from '@/lib/billing/vehicleSalesFields'
import {
  buildStaffHoursRows,
  buildStaffRowsForSave,
  computeDayTotalHours,
} from '@/lib/billing/shiftStaffHours'

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
}) {
  return {
    ...readVehicleFormFromRow(dailyRow, carNum),
    staffHours: buildStaffHoursRows(dayShifts, employees, savedStaffRows, carNum),
    expense_note: dailyRow?.expense_note ?? '',
    expense_amount: dailyRow?.expense_amount ?? '',
    receivable_total: dailyRow?.receivable_total ?? '',
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
}) {
  const dailyPayload = buildDailySalesUpsertPayload(workDate, existingRow, carNum, form)
  dailyPayload.expense_note = nullableText(form.expense_note)
  dailyPayload.expense_amount = parseInt0OrZero(form.expense_amount)
  dailyPayload.receivable_total = parseInt0OrZero(form.receivable_total)
  dailyPayload.total_hours = computeDayTotalHours({
    dayShifts,
    employees,
    carNum,
    formStaffHours: form.staffHours,
    existingStaffRows,
  })

  const staffRows = buildStaffRowsForSave({
    workDate,
    carNum,
    formStaffHours: form.staffHours,
    dayShifts,
    employees,
    existingStaffRows,
  }).filter((row) => row.hours > 0)

  return { dailyPayload, staffRows }
}
