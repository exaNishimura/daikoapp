import { calcShiftWorkHours, normalizeTimeForInput } from '@/lib/billing/shiftStaffHours'
import { getPlannedShiftTimes } from '@/lib/billing/shiftTargetAmount'
import { CAR_OPTIONS, timeToMinutes } from '@/lib/shiftEditUtils'
import { resolveShiftEmployee } from '@/lib/staffFromEmployees'

export const LICENSE_TYPE1 = '一種'
export const LICENSE_TYPE2 = '二種'

const DEFAULT_START = '20:00'
const DEFAULT_END = '06:00'
const MAX_PER_CAR = 2

export function formatTimeRange(start, end) {
  const s = normalizeTimeForInput(start) || start || DEFAULT_START
  const e = normalizeTimeForInput(end) || end || DEFAULT_END
  return `${s}〜${e}`
}

export function formatYen(amount) {
  return `¥${Math.round(Number(amount) || 0).toLocaleString('ja-JP')}`
}

function roundHours(n) {
  return Math.round(n * 100) / 100
}

function licenseOfShift(shift, employees) {
  return resolveShiftEmployee(shift, employees)?.license_type ?? null
}

function activeDateShifts(dateShifts) {
  return (dateShifts ?? []).filter((shift) => !shift?.status)
}

/**
 * 月次希望一覧を日付 → 出勤可スタッフ配列に変換
 */
export function buildRequestsByDate(requestRows) {
  const map = {}
  for (const row of requestRows ?? []) {
    const days = row.payload?.days ?? {}
    for (const [date, day] of Object.entries(days)) {
      if (!day?.available) continue
      if (!map[date]) map[date] = []
      map[date].push({
        employeeId: row.employee_id,
        name: row.employee_name,
        licenseType: row.license_type,
        start: normalizeTimeForInput(day.start) || DEFAULT_START,
        end: normalizeTimeForInput(day.end) || DEFAULT_END,
        notes: row.payload?.notes || '',
      })
    }
  }

  for (const date of Object.keys(map)) {
    map[date].sort((a, b) => {
      if (a.licenseType !== b.licenseType) {
        return a.licenseType === LICENSE_TYPE2 ? -1 : 1
      }
      return String(a.name).localeCompare(String(b.name), 'ja')
    })
  }

  return map
}

export function countAvailableByLicense(dayRequests) {
  let type1 = 0
  let type2 = 0
  for (const request of dayRequests ?? []) {
    if (request.licenseType === LICENSE_TYPE1) type1 += 1
    else if (request.licenseType === LICENSE_TYPE2) type2 += 1
  }
  return { type1, type2 }
}

export function findAdoptedShiftsForEmployee(dateShifts, employeeId, employees) {
  if (!employeeId) return []
  return activeDateShifts(dateShifts).filter((shift) => {
    const emp = resolveShiftEmployee(shift, employees)
    return emp?.id === employeeId
  })
}

export function isEmployeeAdoptedOnDate(dateShifts, employeeId, employees) {
  return findAdoptedShiftsForEmployee(dateShifts, employeeId, employees).length > 0
}

export function getOccupantsForCar(dateShifts, car) {
  return activeDateShifts(dateShifts).filter((shift) => String(shift.car) === String(car))
}

/**
 * 営業時間（19:00〜翌6:00）基準で、より早い終了時刻を返す。
 * 06:00 より 02:00 の方が短い。
 */
export function earlierEndTime(a, b) {
  const na = normalizeTimeForInput(a)
  const nb = normalizeTimeForInput(b)
  if (!na) return nb
  if (!nb) return na
  return timeToMinutes(na) <= timeToMinutes(nb) ? na : nb
}

/**
 * 営業時間基準で、より遅い開始時刻を返す。
 * 20:00 より 23:00 の方が遅い。
 */
export function laterStartTime(a, b) {
  const na = normalizeTimeForInput(a)
  const nb = normalizeTimeForInput(b)
  if (!na) return nb
  if (!nb) return na
  return timeToMinutes(na) >= timeToMinutes(nb) ? na : nb
}

/**
 * 同一号車の既存シフトと突き合わせ、いちばん短い終了時刻にする。
 */
export function alignEndToShorter(candidateEnd, partnerShifts) {
  let end = normalizeTimeForInput(candidateEnd) || ''
  for (const shift of partnerShifts ?? []) {
    const partnerEnd = normalizeTimeForInput(getPlannedShiftTimes(shift).end)
    if (!end) {
      end = partnerEnd
      continue
    }
    if (!partnerEnd) continue
    end = earlierEndTime(end, partnerEnd)
  }
  return end
}

/**
 * 同一号車の既存シフトと突き合わせ、いちばん遅い開始時刻にする。
 */
export function alignStartToLater(candidateStart, partnerShifts) {
  let start = normalizeTimeForInput(candidateStart) || ''
  for (const shift of partnerShifts ?? []) {
    const partnerStart = normalizeTimeForInput(getPlannedShiftTimes(shift).start)
    if (!start) {
      start = partnerStart
      continue
    }
    if (!partnerStart) continue
    start = laterStartTime(start, partnerStart)
  }
  return start
}

/** 終了が alignedEnd より遅いパートナー（切り詰め対象） */
export function partnersNeedingEndTrim(partnerShifts, alignedEnd) {
  const target = normalizeTimeForInput(alignedEnd)
  if (!target) return []
  return (partnerShifts ?? []).filter((shift) => {
    const current = normalizeTimeForInput(getPlannedShiftTimes(shift).end)
    return Boolean(current) && timeToMinutes(target) < timeToMinutes(current)
  })
}

/** 開始が alignedStart より早いパートナー（遅らせる対象） */
export function partnersNeedingStartPush(partnerShifts, alignedStart) {
  const target = normalizeTimeForInput(alignedStart)
  if (!target) return []
  return (partnerShifts ?? []).filter((shift) => {
    const current = normalizeTimeForInput(getPlannedShiftTimes(shift).start)
    return Boolean(current) && timeToMinutes(target) > timeToMinutes(current)
  })
}

function requestedDay(requestRows, employeeId, date) {
  if (!employeeId || !date) return null
  const row = (requestRows ?? []).find((r) => r.employee_id === employeeId)
  const day = row?.payload?.days?.[date]
  if (!day?.available) return null
  return day
}

export function requestedStartForEmployee(requestRows, employeeId, date) {
  return normalizeTimeForInput(requestedDay(requestRows, employeeId, date)?.start) || null
}

export function requestedEndForEmployee(requestRows, employeeId, date) {
  return normalizeTimeForInput(requestedDay(requestRows, employeeId, date)?.end) || null
}

/**
 * 希望採用時の号車・役割を既存シフトから推定。
 * 二種は代行優先、一種は随伴。空きがある車を埋め、1種×1種は避ける。
 */
export function suggestCarAndRole(dateShifts, licenseType, employees = []) {
  const isType2 = licenseType === LICENSE_TYPE2
  const cars = CAR_OPTIONS.map((car) => {
    const occupants = activeDateShifts(dateShifts).filter((shift) => String(shift.car) === car)
    const licenses = occupants.map((shift) => licenseOfShift(shift, employees))
    return {
      car,
      occupants,
      count: occupants.length,
      hasDriver: occupants.some((shift) => shift.role === '代行'),
      type1: licenses.filter((lic) => lic === LICENSE_TYPE1).length,
      type2: licenses.filter((lic) => lic === LICENSE_TYPE2).length,
    }
  })

  const withSpace = cars.filter((car) => car.count < MAX_PER_CAR)
  const pick = (car, role) => ({ car: car.car, role })

  if (isType2) {
    const needsDriver = withSpace.find((car) => car.count > 0 && !car.hasDriver)
    if (needsDriver) return pick(needsDriver, '代行')
    const empty = withSpace.find((car) => car.count === 0)
    if (empty) return pick(empty, '代行')
    const needsCompanion = withSpace.find((car) => car.hasDriver)
    if (needsCompanion) return pick(needsCompanion, '随伴')
  } else {
    const withType2 = withSpace.find((car) => car.type2 > 0)
    if (withType2) return pick(withType2, '随伴')
    const empty = withSpace.find((car) => car.count === 0)
    if (empty) return pick(empty, '随伴')
  }

  const fallback = withSpace[0] || cars[0]
  return {
    car: fallback?.car || '1',
    role: isType2 ? (fallback?.hasDriver ? '随伴' : '代行') : '随伴',
  }
}

export function evaluateDayStaffing(dateShifts, employees) {
  const shifts = activeDateShifts(dateShifts)
  let type1 = 0
  let type2 = 0
  const warnings = []

  for (const shift of shifts) {
    const license = licenseOfShift(shift, employees)
    if (license === LICENSE_TYPE1) type1 += 1
    else if (license === LICENSE_TYPE2) type2 += 1
  }

  for (const car of CAR_OPTIONS) {
    const occupants = shifts.filter((shift) => String(shift.car) === car)
    if (occupants.length === 0) continue
    if (occupants.length === 1) {
      warnings.push(`${car}号車が1名（ペア不足）`)
    }
    const type2OnCar = occupants.filter(
      (shift) => licenseOfShift(shift, employees) === LICENSE_TYPE2
    ).length
    if (occupants.length >= 2 && type2OnCar === 0) {
      warnings.push(`${car}号車が一種のみ（ペア不可）`)
    }
  }

  if (shifts.length > 0 && type2 === 0) {
    warnings.push('二種がいないため1台も成立しません')
  }

  return { type1, type2, warnings }
}

export function computeShiftsLaborCost(shifts, employees) {
  let total = 0
  for (const shift of activeDateShifts(shifts)) {
    const emp = resolveShiftEmployee(shift, employees)
    const { start, end } = getPlannedShiftTimes(shift)
    const hours = calcShiftWorkHours(start, end)
    const wage = Number(emp?.hourly_wage) || 0
    total += Math.round(hours * wage)
  }
  return Math.max(0, total)
}

/**
 * スタッフ別の希望日数・採用日数・想定人件費
 */
export function buildStaffAdoptionSummary({ requestRows, shifts, employees }) {
  const realShifts = activeDateShifts(shifts)
  const requestById = new Map((requestRows ?? []).map((row) => [row.employee_id, row]))
  const adoptedDatesByEmp = new Map()
  const hoursByEmp = new Map()
  const costByEmp = new Map()

  for (const shift of realShifts) {
    const emp = resolveShiftEmployee(shift, employees)
    if (!emp?.id) continue
    if (!adoptedDatesByEmp.has(emp.id)) adoptedDatesByEmp.set(emp.id, new Set())
    adoptedDatesByEmp.get(emp.id).add(shift.date)
    const { start, end } = getPlannedShiftTimes(shift)
    const hours = calcShiftWorkHours(start, end)
    hoursByEmp.set(emp.id, (hoursByEmp.get(emp.id) || 0) + hours)
    const wage = Number(emp.hourly_wage) || 0
    costByEmp.set(emp.id, (costByEmp.get(emp.id) || 0) + Math.round(hours * wage))
  }

  const ids = new Set([...requestById.keys(), ...adoptedDatesByEmp.keys()])
  const empById = new Map((employees ?? []).map((emp) => [emp.id, emp]))

  const rows = []
  for (const id of ids) {
    const request = requestById.get(id)
    const emp = empById.get(id)
    const requestedDays = Object.values(request?.payload?.days ?? {}).filter(
      (day) => day?.available
    ).length
    const adoptedDays = adoptedDatesByEmp.get(id)?.size || 0
    if (requestedDays === 0 && adoptedDays === 0) continue
    rows.push({
      employeeId: id,
      name: request?.employee_name || emp?.name || '',
      licenseType: request?.license_type || emp?.license_type || '',
      requestedDays,
      adoptedDays,
      hours: roundHours(hoursByEmp.get(id) || 0),
      laborCost: costByEmp.get(id) || 0,
    })
  }

  return rows.sort((a, b) => {
    if (a.licenseType !== b.licenseType) {
      return a.licenseType === LICENSE_TYPE2 ? -1 : 1
    }
    return String(a.name).localeCompare(String(b.name), 'ja')
  })
}
