import { supabase } from '@/lib/supabase'
import { getEmployees } from '@/services/employeeService'
import { getShifts } from '@/services/shiftService'
import {
  buildDraftPayslipsForMonth,
  buildPayslipAmounts,
  toYearMonthStart,
} from '@/lib/payroll/calculatePayslip'

const PAYROLL_SELECT = `
  id,
  employee_id,
  year_month,
  status,
  total_hours,
  hourly_wage_snapshot,
  base_pay,
  allowance,
  gross_pay,
  social_insurance,
  other_deduction,
  taxable_base,
  tax_table_type,
  dependents_count,
  withholding_tax,
  withholding_overridden,
  net_pay,
  note,
  published_at,
  created_at,
  updated_at,
  employees ( id, name, employment_type, color )
`

function monthDateRange(yearMonth) {
  const start = toYearMonthStart(yearMonth)
  const [y, m] = start.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/**
 * 対象月の給与明細一覧
 * @param {string} yearMonth YYYY-MM
 */
export async function getPayrollSlipsByMonth(yearMonth) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const ym = toYearMonthStart(yearMonth)
    const { data, error } = await supabase
      .from('payroll_slips')
      .select(PAYROLL_SELECT)
      .eq('year_month', ym)
      .order('created_at', { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching payroll slips:', error)
    return { data: null, error }
  }
}

/**
 * シフト×時給で下書きを一括生成/再計算。PUBLISHED はスキップ。
 * @param {string} yearMonth
 * @param {{ overwritePublished?: boolean }} [options]
 */
export async function generatePayrollDrafts(yearMonth, options = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  const { overwritePublished = false } = options

  try {
    const ym = toYearMonthStart(yearMonth)
    const { start, end } = monthDateRange(ym)

    const [empRes, shiftRes, existingRes] = await Promise.all([
      getEmployees(),
      getShifts(start, end),
      getPayrollSlipsByMonth(ym),
    ])

    if (empRes.error) throw empRes.error
    if (shiftRes.error) throw shiftRes.error
    if (existingRes.error) throw existingRes.error

    const existingByEmployeeId = new Map()
    const publishedIds = new Set()
    for (const row of existingRes.data || []) {
      if (row.status === 'PUBLISHED' && !overwritePublished) {
        publishedIds.add(row.employee_id)
        continue
      }
      existingByEmployeeId.set(row.employee_id, row)
    }

    const drafts = buildDraftPayslipsForMonth({
      employees: empRes.data || [],
      shifts: shiftRes.data || [],
      yearMonth: ym,
      existingByEmployeeId,
    }).filter((d) => !publishedIds.has(d.employee_id))

    const rows = drafts.map((d) => ({
      employee_id: d.employee_id,
      year_month: d.year_month,
      status: 'DRAFT',
      total_hours: d.total_hours,
      hourly_wage_snapshot: d.hourly_wage_snapshot,
      base_pay: d.base_pay,
      allowance: d.allowance,
      gross_pay: d.gross_pay,
      social_insurance: d.social_insurance,
      other_deduction: d.other_deduction,
      taxable_base: d.taxable_base,
      tax_table_type: d.tax_table_type,
      dependents_count: d.dependents_count,
      withholding_tax: d.withholding_tax,
      withholding_overridden: d.withholding_overridden,
      net_pay: d.net_pay,
      note: d.note || '',
      published_at: null,
      updated_at: new Date().toISOString(),
    }))

    if (rows.length === 0) {
      return {
        data: {
          upserted: 0,
          skippedPublished: publishedIds.size,
          slips: existingRes.data || [],
        },
        error: null,
      }
    }

    const { error: upsertError } = await supabase.from('payroll_slips').upsert(rows, {
      onConflict: 'employee_id,year_month',
    })
    if (upsertError) throw upsertError

    const refreshed = await getPayrollSlipsByMonth(ym)
    if (refreshed.error) throw refreshed.error

    return {
      data: {
        upserted: rows.length,
        skippedPublished: publishedIds.size,
        slips: refreshed.data || [],
      },
      error: null,
    }
  } catch (error) {
    console.error('Error generating payroll drafts:', error)
    return { data: null, error }
  }
}

/**
 * 明細の管理者修正
 * @param {string} id
 * @param {object} patch
 * @param {object} [employee] 時給再計算用（省略時は既存スナップショット）
 */
export async function updatePayrollSlip(id, patch, employee = null) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data: current, error: curErr } = await supabase
      .from('payroll_slips')
      .select(PAYROLL_SELECT)
      .eq('id', id)
      .single()
    if (curErr) throw curErr

    const emp = employee || {
      hourly_wage: current.hourly_wage_snapshot,
      tax_table_type: current.tax_table_type,
      dependents_count: current.dependents_count,
    }

    const amounts = buildPayslipAmounts({
      employee: emp,
      totalHours: patch.total_hours ?? current.total_hours,
      allowance: patch.allowance ?? current.allowance,
      socialInsurance: patch.social_insurance ?? current.social_insurance,
      otherDeduction: patch.other_deduction ?? current.other_deduction,
      taxTableType: patch.tax_table_type ?? current.tax_table_type,
      dependentsCount: patch.dependents_count ?? current.dependents_count,
      withholdingOverride: patch.withholding_overridden
        ? patch.withholding_tax
        : patch.withholding_overridden === false
          ? null
          : current.withholding_overridden
            ? (patch.withholding_tax ?? current.withholding_tax)
            : null,
    })

    const payload = {
      total_hours: amounts.total_hours,
      hourly_wage_snapshot: amounts.hourly_wage_snapshot,
      base_pay: amounts.base_pay,
      allowance: amounts.allowance,
      gross_pay: amounts.gross_pay,
      social_insurance: amounts.social_insurance,
      other_deduction: amounts.other_deduction,
      taxable_base: amounts.taxable_base,
      tax_table_type: amounts.tax_table_type,
      dependents_count: amounts.dependents_count,
      withholding_tax: amounts.withholding_tax,
      withholding_overridden: amounts.withholding_overridden,
      net_pay: amounts.net_pay,
      note: patch.note != null ? String(patch.note) : current.note,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('payroll_slips')
      .update(payload)
      .eq('id', id)
      .select(PAYROLL_SELECT)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating payroll slip:', error)
    return { data: null, error }
  }
}

/**
 * @param {string[]} ids
 * @param {'DRAFT'|'PUBLISHED'} status
 */
export async function setPayrollSlipsStatus(ids, status) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }
  if (!ids?.length) {
    return { data: { updated: 0 }, error: null }
  }

  try {
    const payload = {
      status,
      published_at: status === 'PUBLISHED' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('payroll_slips')
      .update(payload)
      .in('id', ids)
      .select('id')

    if (error) throw error
    return { data: { updated: data?.length || 0 }, error: null }
  } catch (error) {
    console.error('Error setting payroll status:', error)
    return { data: null, error }
  }
}
