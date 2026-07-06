import { findEmployeeByStaffName, getStaffDisplayName } from '@/lib/staffFromEmployees'

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

/** TIME / HH:MM / HH:MM:SS を type="time" 用 HH:MM に正規化 */
export function normalizeTimeForInput(value) {
  if (value == null || value === '') return ''
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

export function normalizeTimeForSave(value) {
  return normalizeTimeForInput(value)
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

function shiftStartSortKey(shift) {
  const [h, m] = normalizeTimeForInput(shift.start).split(':').map(Number)
  if (!Number.isFinite(h)) return 9999
  // 19:00 基準のシフト表に合わせ、19 時未満は翌日扱いで後ろに
  const minutes = h >= 19 ? h * 60 + m : (24 + h) * 60 + m
  return minutes
}

/**
 * 売上入力モーダル用: 号車の各シフト行（開始・終了）。
 */
export function buildShiftTimeRows(shifts, employees, carNum) {
  return filterShiftsByCar(shifts, carNum)
    .filter((shift) => shift?.id && getStaffDisplayName(shift, employees))
    .sort((a, b) => shiftStartSortKey(a) - shiftStartSortKey(b))
    .map((shift) => ({
      shiftId: shift.id,
      staffName: getStaffDisplayName(shift, employees),
      role: shift.role ?? '',
      start: normalizeTimeForInput(shift.start),
      end: normalizeTimeForInput(shift.end),
    }))
}

/**
 * フォームの開始/終了を当日シフトにマージした配列を返す。
 */
export function applyShiftTimeUpdates(dayShifts, shiftTimeUpdates = []) {
  const updatesById = new Map(
    (shiftTimeUpdates ?? [])
      .filter((row) => row?.shiftId)
      .map((row) => [row.shiftId, row])
  )
  if (updatesById.size === 0) return dayShifts ?? []

  return (dayShifts ?? []).map((shift) => {
    const update = updatesById.get(shift.id)
    if (!update) return shift
    return {
      ...shift,
      start: normalizeTimeForSave(update.start) || shift.start,
      end: normalizeTimeForSave(update.end) || shift.end,
    }
  })
}

export function sumShiftTimesHours(shiftTimes) {
  return roundHours(
    (shiftTimes ?? []).reduce((sum, row) => sum + calcShiftWorkHours(row.start, row.end), 0)
  )
}

/** @deprecated sumShiftTimesHours を使用 */
export function sumStaffHours(staffHours) {
  return roundHours(
    (staffHours ?? []).reduce((sum, row) => {
      const h = Number(row.hours)
      return sum + (Number.isFinite(h) ? h : 0)
    }, 0)
  )
}

/**
 * 保存用: シフト start/end 更新ペイロード
 */
export function buildShiftUpdatePayloads(shiftTimeUpdates = []) {
  return (shiftTimeUpdates ?? [])
    .filter((row) => row?.shiftId && row.start && row.end)
    .map((row) => ({
      id: row.shiftId,
      shiftData: {
        start: normalizeTimeForSave(row.start),
        end: normalizeTimeForSave(row.end),
      },
    }))
}

/**
 * 当日の total_hours（全号車合算）を算出。
 */
export function computeDayStaffHoursRows({
  dayShifts,
  employees,
  shiftTimeUpdates = [],
}) {
  const effective = applyShiftTimeUpdates(dayShifts, shiftTimeUpdates)
  const map = computeStaffHoursFromShifts(effective, employees)
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([staff_name, hours]) => ({ staff_name, hours: roundHours(hours) }))
    .filter((row) => row.hours > 0)
}

/**
 * 稼働時間 × 従業員マスタ時給で人件費を算出（円、四捨五入）
 */
export function computeLaborCostFromStaffHours(staffRows, employees) {
  let total = 0
  for (const row of staffRows ?? []) {
    const hours = Number(row.hours) || 0
    if (hours <= 0) continue
    const emp = findEmployeeByStaffName(employees, row.staff_name)
    const hourly = Number(emp?.hourly_wage) || 0
    total += Math.round(hours * hourly)
  }
  return Math.max(0, total)
}

export function computeDayTotalHours(params) {
  return roundHours(
    computeDayStaffHoursRows(params).reduce((sum, row) => sum + row.hours, 0)
  )
}
