import { calcShiftWorkHours } from '@/lib/billing/shiftStaffHours'
import { resolveShiftEmployee } from '@/lib/staffFromEmployees'

const TARGET_OVERHEAD_YEN = 3000

export function getPlannedShiftTimes(shift) {
  return {
    start: shift?.planned_start ?? shift?.start,
    end: shift?.planned_end ?? shift?.end,
  }
}

/**
 * シフト設定時の予定稼働から日次目標金額（円）を算出。
 * 売上入力で更新された実績 start/end は使わない。
 */
export function computeDayTargetAmount({ shifts, employees, status }) {
  if (status || !shifts?.length) return null

  const employeeMap = {}
  for (const emp of employees ?? []) {
    if (emp?.id) employeeMap[emp.id] = emp
  }

  let totalWage = 0

  for (const shift of shifts) {
    const { start, end } = getPlannedShiftTimes(shift)
    if (!start || !end) continue

    const employee =
      (shift.employee_id && employeeMap[shift.employee_id]) ||
      resolveShiftEmployee(shift, employees)
    const hourlyWage = Number(employee?.hourly_wage) || 0
    if (hourlyWage <= 0) continue

    totalWage += hourlyWage * calcShiftWorkHours(start, end)
  }

  return totalWage + TARGET_OVERHEAD_YEN
}

/** 表示用: 1000円単位で切り上げ */
export function roundTargetDisplayAmount(amount) {
  if (amount == null || amount <= 0) return null
  return Math.ceil(Math.round(amount) / 1000) * 1000
}
