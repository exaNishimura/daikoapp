import { getDailySalesByDate, upsertDailySale } from '@/services/billing/dailySalesService'
import {
  getDailyStaffSalesByDate,
  upsertDailyStaffSalesBatch,
} from '@/services/billing/dailyStaffSalesService'
import { getReceivablesByWorkDate, updateReceivable } from '@/services/billing/receivablesService'
import { getShifts, updateShiftsBulk } from '@/services/shiftService'
import { getActiveEmployees } from '@/services/employeeService'
import {
  buildReceivableVehicleNumUpdates,
  buildShiftCarUpdates,
  decideReassignMode,
  hasVehicleData,
  swapVehicleFields,
} from '@/lib/billing/reassignVehicleSales'
import {
  computeDayStaffHoursRows,
  computeDayTotalHours,
  computeLaborCostFromStaffHours,
} from '@/lib/billing/shiftStaffHours'
import { computeCashFromShiftSales } from '@/lib/billing/dailySalesCalc'
import { sumReceivableAmounts } from '@/lib/billing/shiftReceivables'
import { getVehicleFieldKeys } from '@/lib/billing/vehicleSalesFields'

function applyCarUpdatesToShifts(dayShifts, carUpdates) {
  const byId = new Map(carUpdates.map((u) => [u.id, u.car]))
  return (dayShifts ?? []).map((shift) => {
    if (!byId.has(shift.id)) return shift
    return { ...shift, car: byId.get(shift.id) }
  })
}

function applyReceivableUpdates(rows, updates) {
  const byId = new Map(updates.map((u) => [u.id, u.vehicle_num]))
  return (rows ?? []).map((row) => {
    if (!byId.has(row.id)) return row
    return { ...row, vehicle_num: byId.get(row.id) }
  })
}

/**
 * 当日の号車付け替え／入れ替え
 */
export async function reassignVehicleSales({ workDate, fromCar, toCar }) {
  if (!workDate) {
    return { data: null, error: new Error('営業日が指定されていません') }
  }
  if (!getVehicleFieldKeys(fromCar) || !getVehicleFieldKeys(toCar)) {
    return {
      data: null,
      error: new Error(`未対応の号車です（${fromCar} → ${toCar}）`),
    }
  }

  try {
    const [saleRes, shiftsRes, recvRes, staffRes, empRes] = await Promise.all([
      getDailySalesByDate(workDate),
      getShifts(workDate, workDate),
      getReceivablesByWorkDate(workDate),
      getDailyStaffSalesByDate(workDate),
      getActiveEmployees(),
    ])

    for (const res of [saleRes, shiftsRes, recvRes, staffRes, empRes]) {
      if (res.error) throw res.error
    }

    const dailyRow = saleRes.data
    const dayShifts = shiftsRes.data ?? []
    const receivableRows = recvRes.data ?? []
    const existingStaffRows = staffRes.data ?? []
    const employees = empRes.data ?? []

    const hasToData = hasVehicleData({
      carNum: toCar,
      dailyRow,
      dayShifts,
      receivableRows,
    })
    const mode = decideReassignMode({ fromCar, toCar, hasToData })

    const shiftUpdates = buildShiftCarUpdates(dayShifts, fromCar, toCar, mode)
    const receivableUpdates = buildReceivableVehicleNumUpdates(receivableRows, fromCar, toCar, mode)
    const swappedDaily = swapVehicleFields(dailyRow, fromCar, toCar, mode)

    if (shiftUpdates.length > 0) {
      const { error } = await updateShiftsBulk(
        shiftUpdates.map(({ id, car }) => ({ id, shiftData: { car } }))
      )
      if (error) throw error
    }

    for (const update of receivableUpdates) {
      const { error } = await updateReceivable(update.id, {
        vehicle_num: update.vehicle_num,
      })
      if (error) throw error
    }

    const updatedShifts = applyCarUpdatesToShifts(dayShifts, shiftUpdates)
    const updatedReceivables = applyReceivableUpdates(receivableRows, receivableUpdates)

    const dayStaffHoursRows = computeDayStaffHoursRows({
      dayShifts: updatedShifts,
      employees,
    })
    const hoursByName = new Map(dayStaffHoursRows.map((row) => [row.staff_name, row.hours]))
    const existingSalesByName = new Map(existingStaffRows.map((r) => [r.staff_name, r.sales ?? 0]))
    const staffNames = new Set([
      ...hoursByName.keys(),
      ...existingStaffRows.map((r) => r.staff_name),
    ])
    const staffRows = [...staffNames]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ja'))
      .map((staff_name) => ({
        work_date: workDate,
        staff_name,
        hours: hoursByName.get(staff_name) ?? 0,
        sales: existingSalesByName.get(staff_name) ?? 0,
      }))

    const receivable_total = sumReceivableAmounts(updatedReceivables)
    const dailyPayload = {
      work_date: workDate,
      vehicle1_distance_km: swappedDaily.vehicle1_distance_km ?? null,
      vehicle2_distance_km: swappedDaily.vehicle2_distance_km ?? null,
      vehicle1_fuel_yen: swappedDaily.vehicle1_fuel_yen ?? 0,
      vehicle2_fuel_yen: swappedDaily.vehicle2_fuel_yen ?? 0,
      vehicle1_sales: swappedDaily.vehicle1_sales ?? 0,
      vehicle2_sales: swappedDaily.vehicle2_sales ?? 0,
      vehicle1_expense_note: swappedDaily.vehicle1_expense_note ?? null,
      vehicle2_expense_note: swappedDaily.vehicle2_expense_note ?? null,
      vehicle1_expense_amount: swappedDaily.vehicle1_expense_amount ?? 0,
      vehicle2_expense_amount: swappedDaily.vehicle2_expense_amount ?? 0,
      total_hours: computeDayTotalHours({ dayShifts: updatedShifts, employees }),
      labor_cost: computeLaborCostFromStaffHours(dayStaffHoursRows, employees),
      receivable_total,
      cash: 0,
      source_file: dailyRow?.source_file ?? null,
    }
    dailyPayload.cash = computeCashFromShiftSales(dailyPayload)

    const { data: savedDaily, error: dailyError } = await upsertDailySale(dailyPayload)
    if (dailyError) throw dailyError

    if (staffRows.length > 0) {
      const { error: staffError } = await upsertDailyStaffSalesBatch(workDate, staffRows)
      if (staffError) throw staffError
    }

    return {
      data: {
        mode,
        fromCar: String(fromCar),
        toCar: String(toCar),
        daily: savedDaily,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error reassigning vehicle sales:', error)
    return { data: null, error }
  }
}
