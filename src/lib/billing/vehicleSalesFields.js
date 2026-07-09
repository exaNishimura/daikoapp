/** 号車番号 → daily_sales カラム */
export const VEHICLE_FIELD_MAP = Object.freeze({
  '1': {
    distance_km: 'vehicle1_distance_km',
    fuel_yen: 'vehicle1_fuel_yen',
    sales: 'vehicle1_sales',
    expense_note: 'vehicle1_expense_note',
    expense_amount: 'vehicle1_expense_amount',
  },
  '2': {
    distance_km: 'vehicle2_distance_km',
    fuel_yen: 'vehicle2_fuel_yen',
    sales: 'vehicle2_sales',
    expense_note: 'vehicle2_expense_note',
    expense_amount: 'vehicle2_expense_amount',
  },
})

export function getVehicleFieldKeys(carNum) {
  return VEHICLE_FIELD_MAP[String(carNum)] ?? null
}

function parseNumOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

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
 * 号車単位の入力を既存 daily_sales 行にマージした UPSERT 用ペイロード
 */
export function buildDailySalesUpsertPayload(workDate, existingRow, carNum, vehicleForm) {
  const fields = getVehicleFieldKeys(carNum)
  if (!fields) {
    throw new Error(`未対応の号車: ${carNum}`)
  }

  const payload = {
    work_date: workDate,
    vehicle1_distance_km: existingRow?.vehicle1_distance_km ?? null,
    vehicle2_distance_km: existingRow?.vehicle2_distance_km ?? null,
    vehicle1_fuel_yen: existingRow?.vehicle1_fuel_yen ?? 0,
    vehicle2_fuel_yen: existingRow?.vehicle2_fuel_yen ?? 0,
    vehicle1_sales: existingRow?.vehicle1_sales ?? 0,
    vehicle2_sales: existingRow?.vehicle2_sales ?? 0,
    vehicle1_expense_note: existingRow?.vehicle1_expense_note ?? null,
    vehicle2_expense_note: existingRow?.vehicle2_expense_note ?? null,
    vehicle1_expense_amount: existingRow?.vehicle1_expense_amount ?? 0,
    vehicle2_expense_amount: existingRow?.vehicle2_expense_amount ?? 0,
    labor_cost: existingRow?.labor_cost ?? 0,
    cash: existingRow?.cash ?? 0,
  }

  payload[fields.distance_km] = parseNumOrNull(vehicleForm.distance_km)
  payload[fields.fuel_yen] = parseInt0OrZero(vehicleForm.fuel_yen)
  payload[fields.sales] = parseInt0OrZero(vehicleForm.sales)
  payload[fields.expense_note] = nullableText(vehicleForm.expense_note)
  payload[fields.expense_amount] = parseInt0OrZero(vehicleForm.expense_amount)

  return payload
}

export function readVehicleFormFromRow(row, carNum) {
  const fields = getVehicleFieldKeys(carNum)
  if (!fields) {
    return {
      distance_km: '',
      fuel_yen: '',
      sales: '',
      expense_note: '',
      expense_amount: '',
    }
  }
  return {
    distance_km: row?.[fields.distance_km] ?? '',
    fuel_yen: row?.[fields.fuel_yen] ?? '',
    sales: row?.[fields.sales] ?? '',
    expense_note: row?.[fields.expense_note] ?? '',
    expense_amount: row?.[fields.expense_amount] ?? '',
  }
}
