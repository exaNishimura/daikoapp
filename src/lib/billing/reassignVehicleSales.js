import { VEHICLE_FIELD_MAP, getVehicleFieldKeys } from '@/lib/billing/vehicleSalesFields'

const EMPTY_VEHICLE_VALUES = Object.freeze({
  distance_km: null,
  fuel_yen: 0,
  sales: 0,
  expense_note: null,
  expense_amount: 0,
})

export function getReassignableCarNums(excludeCar = null) {
  const exclude = excludeCar == null || excludeCar === '' ? null : String(excludeCar)
  return Object.keys(VEHICLE_FIELD_MAP)
    .filter((car) => car !== exclude)
    .sort((a, b) => Number(a) - Number(b))
}

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function hasText(v) {
  return v != null && String(v).trim() !== ''
}

/** 日次売上行について当該号車カラムに実質入力があるか */
export function hasDailyVehicleInput(dailyRow, carNum) {
  const fields = getVehicleFieldKeys(carNum)
  if (!fields || !dailyRow) return false
  if (dailyRow[fields.distance_km] != null && dailyRow[fields.distance_km] !== '') return true
  if (n(dailyRow[fields.fuel_yen]) > 0) return true
  if (n(dailyRow[fields.sales]) > 0) return true
  if (n(dailyRow[fields.expense_amount]) > 0) return true
  if (hasText(dailyRow[fields.expense_note])) return true
  return false
}

export function hasVehicleShifts(dayShifts = [], carNum) {
  const car = String(carNum)
  return (dayShifts ?? []).some((s) => s?.car != null && String(s.car) === car)
}

/** 未請求かつ号車一致の売掛があるか */
export function hasOpenReceivablesForVehicle(receivableRows = [], carNum) {
  const car = String(carNum)
  return (receivableRows ?? []).some(
    (row) => row?.invoice_id == null && row?.vehicle_num != null && String(row.vehicle_num) === car
  )
}

/**
 * 変更先に「号車データあり」かどうか
 */
export function hasVehicleData({ carNum, dailyRow, dayShifts, receivableRows }) {
  if (carNum == null || carNum === '') return false
  return (
    hasVehicleShifts(dayShifts, carNum) ||
    hasDailyVehicleInput(dailyRow, carNum) ||
    hasOpenReceivablesForVehicle(receivableRows, carNum)
  )
}

/**
 * @returns {'reassign'|'swap'}
 */
export function decideReassignMode({ fromCar, toCar, hasToData }) {
  if (fromCar == null || toCar == null || String(fromCar) === '' || String(toCar) === '') {
    throw new Error('号車が指定されていません')
  }
  if (String(fromCar) === String(toCar)) {
    throw new Error('同じ号車には変更できません')
  }
  if (!getVehicleFieldKeys(fromCar) || !getVehicleFieldKeys(toCar)) {
    throw new Error(`未対応の号車です（${fromCar} → ${toCar}）`)
  }
  return hasToData ? 'swap' : 'reassign'
}

function readVehicleValues(row, fields) {
  return {
    distance_km: row?.[fields.distance_km] ?? null,
    fuel_yen: row?.[fields.fuel_yen] ?? 0,
    sales: row?.[fields.sales] ?? 0,
    expense_note: row?.[fields.expense_note] ?? null,
    expense_amount: row?.[fields.expense_amount] ?? 0,
  }
}

function applyVehicleValues(target, fields, values) {
  target[fields.distance_km] = values.distance_km
  target[fields.fuel_yen] = values.fuel_yen
  target[fields.sales] = values.sales
  target[fields.expense_note] = values.expense_note
  target[fields.expense_amount] = values.expense_amount
}

/**
 * daily_sales 行の号車カラムを付け替え／入れ替えした断片を返す
 */
export function swapVehicleFields(dailyRow, fromCar, toCar, mode) {
  const fromFields = getVehicleFieldKeys(fromCar)
  const toFields = getVehicleFieldKeys(toCar)
  if (!fromFields || !toFields) {
    throw new Error(`未対応の号車: ${fromCar} → ${toCar}`)
  }

  const next = { ...(dailyRow ?? {}) }
  const fromValues = readVehicleValues(dailyRow, fromFields)
  const toValues = readVehicleValues(dailyRow, toFields)

  if (mode === 'swap') {
    applyVehicleValues(next, fromFields, toValues)
    applyVehicleValues(next, toFields, fromValues)
  } else {
    applyVehicleValues(next, toFields, fromValues)
    applyVehicleValues(next, fromFields, { ...EMPTY_VEHICLE_VALUES })
  }

  return next
}

/**
 * @returns {Array<{ id: string, car: string }>}
 */
export function buildShiftCarUpdates(dayShifts = [], fromCar, toCar, mode) {
  const from = String(fromCar)
  const to = String(toCar)
  const updates = []

  for (const shift of dayShifts ?? []) {
    if (!shift?.id || shift.car == null) continue
    const car = String(shift.car)
    if (mode === 'swap') {
      if (car === from) updates.push({ id: shift.id, car: to })
      else if (car === to) updates.push({ id: shift.id, car: from })
    } else if (car === from) {
      updates.push({ id: shift.id, car: to })
    }
  }

  return updates
}

/**
 * 未請求売掛のみ vehicle_num 更新ペイロード
 * @returns {Array<{ id: number|string, vehicle_num: number }>}
 */
export function buildReceivableVehicleNumUpdates(rows = [], fromCar, toCar, mode) {
  const from = String(fromCar)
  const to = String(toCar)
  const fromNum = Number(fromCar)
  const toNum = Number(toCar)
  const updates = []

  for (const row of rows ?? []) {
    if (row?.id == null) continue
    if (row.invoice_id != null) continue
    if (row.vehicle_num == null) continue
    const car = String(row.vehicle_num)
    if (mode === 'swap') {
      if (car === from) updates.push({ id: row.id, vehicle_num: toNum })
      else if (car === to) updates.push({ id: row.id, vehicle_num: fromNum })
    } else if (car === from) {
      updates.push({ id: row.id, vehicle_num: toNum })
    }
  }

  return updates
}

/**
 * 売上入力フォームが初期値から変更されているか
 */
export function isVehicleSalesFormDirty(current, initial) {
  if (!current || !initial) return false

  const scalarKeys = ['distance_km', 'fuel_yen', 'sales', 'expense_note', 'expense_amount']
  for (const key of scalarKeys) {
    if (String(current[key] ?? '') !== String(initial[key] ?? '')) return true
  }

  const curTimes = current.shiftTimes ?? []
  const iniTimes = initial.shiftTimes ?? []
  if (curTimes.length !== iniTimes.length) return true
  for (let i = 0; i < curTimes.length; i += 1) {
    const a = curTimes[i]
    const b = iniTimes[i]
    if (
      a.shiftId !== b.shiftId ||
      String(a.start ?? '') !== String(b.start ?? '') ||
      String(a.end ?? '') !== String(b.end ?? '')
    ) {
      return true
    }
  }

  const curRecv = current.receivables ?? []
  const iniRecv = initial.receivables ?? []
  if (curRecv.length !== iniRecv.length) return true
  for (let i = 0; i < curRecv.length; i += 1) {
    const a = curRecv[i]
    const b = iniRecv[i]
    if (
      String(a.company_id ?? '') !== String(b.company_id ?? '') ||
      String(a.amount ?? '') !== String(b.amount ?? '') ||
      String(a.note ?? '') !== String(b.note ?? '')
    ) {
      return true
    }
  }

  return false
}
