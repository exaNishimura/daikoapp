import { calcShiftWorkHours } from '@/lib/billing/shiftStaffHours'
import { getStaffDisplayName, resolveShiftEmployee } from '@/lib/staffFromEmployees'
import {
  TAX_TABLE_OTSU,
  calcTaxableBase,
  calcWithholdingTax,
  normalizeTaxTableType,
  summarizeWithholding,
} from '@/lib/payroll/withholdingTax'

/**
 * 対象月の月初日文字列 YYYY-MM-01
 * @param {string|Date} yearMonth YYYY-MM or YYYY-MM-DD or Date
 */
export function toYearMonthStart(yearMonth) {
  if (yearMonth instanceof Date) {
    const y = yearMonth.getFullYear()
    const m = String(yearMonth.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}-01`
  }
  const s = String(yearMonth ?? '').trim()
  const m = s.match(/^(\d{4})-(\d{2})/)
  if (!m) throw new Error(`Invalid yearMonth: ${yearMonth}`)
  return `${m[1]}-${m[2]}-01`
}

/**
 * 対象月のシフトから従業員別稼働時間を集計
 * @returns {Map<string, number>} employeeId -> hours
 */
export function aggregateHoursByEmployee(shifts, employees) {
  const map = new Map()
  for (const shift of shifts ?? []) {
    const emp = resolveShiftEmployee(shift, employees)
    if (!emp?.id) continue
    const hours = calcShiftWorkHours(shift.start, shift.end)
    if (hours <= 0) continue
    map.set(emp.id, (map.get(emp.id) ?? 0) + hours)
  }
  for (const [id, hours] of map) {
    map.set(id, Math.round(hours * 100) / 100)
  }
  return map
}

/**
 * 1人分の給与明細金額を計算（永続化前のプレビュー）
 * @param {object} params
 * @param {object} params.employee
 * @param {number} params.totalHours
 * @param {number} [params.allowance=0]
 * @param {number} [params.socialInsurance=0]
 * @param {number} [params.otherDeduction=0]
 * @param {string} [params.taxTableType]
 * @param {number} [params.dependentsCount]
 * @param {number|null} [params.withholdingOverride] 手修正税額
 */
export function buildPayslipAmounts({
  employee,
  totalHours,
  allowance = 0,
  socialInsurance = 0,
  otherDeduction = 0,
  taxTableType,
  dependentsCount,
  withholdingOverride = null,
} = {}) {
  const hours = Math.round((Number(totalHours) || 0) * 100) / 100
  const hourly = Number(employee?.hourly_wage) || 0
  const basePay = Math.round(hours * hourly)
  const allow = Math.max(0, Math.floor(Number(allowance) || 0))
  const grossPay = basePay + allow
  const social = Math.max(0, Math.floor(Number(socialInsurance) || 0))
  const other = Math.max(0, Math.floor(Number(otherDeduction) || 0))
  const table = normalizeTaxTableType(
    taxTableType ?? employee?.tax_table_type ?? TAX_TABLE_OTSU
  )
  const deps = Math.min(
    5,
    Math.max(0, Math.floor(Number(dependentsCount ?? employee?.dependents_count) || 0))
  )

  const taxableBase = calcTaxableBase(grossPay, social)
  const autoTax = calcWithholdingTax({
    grossPay,
    socialInsurance: social,
    taxTableType: table,
    dependentsCount: deps,
  })
  const overridden = withholdingOverride != null && withholdingOverride !== ''
  const withholdingTax = overridden
    ? Math.max(0, Math.floor(Number(withholdingOverride) || 0))
    : autoTax
  const netPay = Math.max(0, taxableBase - withholdingTax - other)

  return {
    total_hours: hours,
    hourly_wage_snapshot: hourly,
    base_pay: basePay,
    allowance: allow,
    gross_pay: grossPay,
    social_insurance: social,
    other_deduction: other,
    taxable_base: taxableBase,
    tax_table_type: table,
    dependents_count: deps,
    withholding_tax: withholdingTax,
    withholding_overridden: overridden,
    net_pay: netPay,
    auto_withholding_tax: autoTax,
  }
}

/**
 * 雇用従業員向けの下書き行を生成
 * @param {object} params
 * @param {Array} params.employees
 * @param {Array} params.shifts
 * @param {string} params.yearMonth
 * @param {Map<string, object>} [params.existingByEmployeeId] 既存 DRAFT の手当等を引き継ぐ
 */
export function buildDraftPayslipsForMonth({
  employees,
  shifts,
  yearMonth,
  existingByEmployeeId = new Map(),
} = {}) {
  const ym = toYearMonthStart(yearMonth)
  const hoursMap = aggregateHoursByEmployee(shifts, employees)
  const employed = (employees ?? []).filter(
    (e) => e.is_active !== false && (e.employment_type ?? 'EMPLOYED') === 'EMPLOYED'
  )

  return employed.map((employee) => {
    const existing = existingByEmployeeId.get(employee.id)
    const hours = hoursMap.get(employee.id) ?? 0
    const amounts = buildPayslipAmounts({
      employee,
      totalHours: hours,
      allowance: existing?.allowance ?? 0,
      socialInsurance: existing?.social_insurance ?? 0,
      otherDeduction: existing?.other_deduction ?? 0,
      taxTableType: existing?.tax_table_type ?? employee.tax_table_type,
      dependentsCount: existing?.dependents_count ?? employee.dependents_count,
      withholdingOverride: existing?.withholding_overridden
        ? existing.withholding_tax
        : null,
    })

    return {
      employee_id: employee.id,
      employee_name: employee.name ?? getStaffDisplayName({ employee_id: employee.id }, employees),
      year_month: ym,
      status: 'DRAFT',
      note: existing?.note ?? '',
      ...amounts,
    }
  })
}

export { summarizeWithholding }
