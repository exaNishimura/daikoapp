import { getStaffDisplayName } from '@/lib/staffFromEmployees'

/**
 * シフトの start/end (HH:MM) から勤務時間（時間）を計算。翌日跨ぎ対応。
 */
export function calcShiftWorkHours(start, end) {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) {
    return 0
  }
  const startMinutes = sh * 60 + sm
  let endMinutes = eh * 60 + em
  if (endMinutes <= startMinutes) endMinutes += 24 * 60
  return (endMinutes - startMinutes) / 60
}

export function filterShiftsByCar(shifts, carNum) {
  if (carNum == null || carNum === '') return shifts ?? []
  const car = String(carNum)
  return (shifts ?? []).filter((s) => String(s.car) === car)
}

/**
 * 当日シフトからスタッフ別稼働時間を集計。
 * @returns {Map<string, number>} staffName -> hours
 */
export function computeStaffHoursFromShifts(shifts, employees) {
  const map = new Map()
  for (const shift of shifts ?? []) {
    const name = getStaffDisplayName(shift, employees)
    if (!name) continue
    const hours = calcShiftWorkHours(shift.start, shift.end)
    map.set(name, (map.get(name) ?? 0) + hours)
  }
  return map
}

/** 指定号車のシフトのみでスタッフ別稼働時間を集計 */
export function computeStaffHoursByCar(shifts, employees, carNum) {
  return computeStaffHoursFromShifts(filterShiftsByCar(shifts, carNum), employees)
}

/** 指定号車以外のシフトでスタッフ別稼働時間を集計 */
export function computeStaffHoursOtherCars(shifts, employees, carNum) {
  const car = String(carNum)
  const other = (shifts ?? []).filter((s) => String(s.car) !== car)
  return computeStaffHoursFromShifts(other, employees)
}

function roundHours(n) {
  return Math.round(n * 100) / 100
}

function formatHoursValue(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return ''
  return String(roundHours(Number(n)))
}

/**
 * 号車別の表示用時間を算出。
 * 保存済みがある場合は「全体 − 他号車シフト基準値」で当該号車分を推定する。
 */
function resolveCarSpecificHours(staffName, carNum, dayShifts, employees, savedRows) {
  const carBaseline = computeStaffHoursByCar(dayShifts, employees, carNum).get(staffName) ?? 0
  const saved = (savedRows ?? []).find((r) => r.staff_name === staffName)
  if (!saved) return carBaseline

  const otherBaseline = computeStaffHoursOtherCars(dayShifts, employees, carNum).get(staffName) ?? 0
  const savedTotal = Number(saved.hours)
  if (!Number.isFinite(savedTotal)) return carBaseline

  if (otherBaseline === 0) return savedTotal
  return Math.max(0, roundHours(savedTotal - otherBaseline))
}

/**
 * モーダル表示用スタッフ行（号車別）。
 */
export function buildStaffHoursRows(shifts, employees, savedRows = [], carNum) {
  const carShifts = filterShiftsByCar(shifts, carNum)
  const computed = computeStaffHoursByCar(shifts, employees, carNum)
  const savedOnCar = new Set(
    (savedRows ?? [])
      .filter((r) => {
        const other = computeStaffHoursOtherCars(shifts, employees, carNum).get(r.staff_name) ?? 0
        const car = computed.get(r.staff_name) ?? 0
        return car > 0 || (Number(r.hours) > 0 && other === 0)
      })
      .map((r) => r.staff_name)
  )
  const names = new Set([...computed.keys(), ...savedOnCar])

  return [...names]
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .map((staffName) => ({
      staffName,
      hours: formatHoursValue(
        resolveCarSpecificHours(staffName, carNum, shifts, employees, savedRows)
      ),
    }))
    .filter((row) => {
      const hasShift = carShifts.some(
        (s) => getStaffDisplayName(s, employees) === row.staffName
      )
      return hasShift || row.hours !== ''
    })
}

export function sumStaffHours(staffHours) {
  return roundHours(
    (staffHours ?? []).reduce((sum, row) => {
      const h = Number(row.hours)
      return sum + (Number.isFinite(h) ? h : 0)
    }, 0)
  )
}

function parseNumOrZero(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, roundHours(n)) : 0
}

/**
 * 保存用: 号車別入力を日次スタッフ合計にマージする。
 */
export function buildStaffRowsForSave({
  workDate,
  carNum,
  formStaffHours,
  dayShifts,
  employees,
  existingStaffRows = [],
}) {
  const existingByName = new Map((existingStaffRows ?? []).map((r) => [r.staff_name, r]))
  const carBaseline = computeStaffHoursByCar(dayShifts, employees, carNum)
  const otherBaseline = computeStaffHoursOtherCars(dayShifts, employees, carNum)

  return (formStaffHours ?? []).map((row) => {
    const formCarHours = parseNumOrZero(row.hours)
    const baseCar = carBaseline.get(row.staffName) ?? 0
    const baseOther = otherBaseline.get(row.staffName) ?? 0
    const existing = existingByName.get(row.staffName)
    const existingTotal = existing != null ? Number(existing.hours) : baseCar + baseOther
    const priorCar =
      existing != null && baseOther > 0
        ? Math.max(0, roundHours(existingTotal - baseOther))
        : baseCar
    const newTotal =
      baseOther > 0 ? roundHours(baseOther + formCarHours) : formCarHours || priorCar

    return {
      work_date: workDate,
      staff_name: row.staffName,
      hours: newTotal,
      sales: existing?.sales ?? 0,
    }
  })
}

/**
 * 当日の total_hours（全号車合算）を算出。
 */
export function computeDayTotalHours({
  dayShifts,
  employees,
  carNum,
  formStaffHours,
  existingStaffRows = [],
}) {
  const merged = buildStaffRowsForSave({
    workDate: '',
    carNum,
    formStaffHours,
    dayShifts,
    employees,
    existingStaffRows,
  })
  const mergedByName = new Map(merged.map((r) => [r.staff_name, r.hours]))

  const allNames = new Set([
    ...computeStaffHoursFromShifts(dayShifts, employees).keys(),
    ...(existingStaffRows ?? []).map((r) => r.staff_name),
    ...merged.map((r) => r.staff_name),
  ])

  let total = 0
  for (const name of allNames) {
    if (mergedByName.has(name)) {
      total += mergedByName.get(name) ?? 0
      continue
    }
    const existing = (existingStaffRows ?? []).find((r) => r.staff_name === name)
    if (existing) {
      total += Number(existing.hours) || 0
      continue
    }
    total += computeStaffHoursFromShifts(dayShifts, employees).get(name) ?? 0
  }
  return roundHours(total)
}
