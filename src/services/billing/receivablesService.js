import { supabase } from '@/lib/supabase'
import { buildShiftReceivableInsertPayloads } from '@/lib/billing/shiftReceivables'

/**
 * 売掛 (accounts_receivable) の CRUD と集計取得。
 *
 * billing_month は DB 制約 (CHECK day=1) で月初日 (YYYY-MM-01) のみ許可。
 * year/month を渡したら toBillingMonth(year, month) で文字列化する。
 */

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

/**
 * (year, month) → "YYYY-MM-01" 文字列。Supabase に渡す DATE 型として安全。
 */
export function toBillingMonth(year, month) {
  const m = String(month).padStart(2, '0')
  return `${year}-${m}-01`
}

/**
 * 売掛一覧 (フィルタ付き)。
 * @param {Object} [filter]
 * @param {number} [filter.year]
 * @param {number} [filter.month]
 * @param {number} [filter.companyId]
 * @param {boolean} [filter.invoiced]   true=請求済のみ, false=未請求のみ, undefined=両方
 * @param {boolean} [filter.paid]       true=入金済のみ (invoices.paid_at に依存)
 */
export async function getReceivables(filter = {}) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    let q = supabase
      .from('accounts_receivable')
      .select('*, companies(id, name, invoice_display_name), invoices(id, paid_at)')
      .order('work_date', { ascending: true })

    if (filter.year && filter.month) {
      q = q.eq('billing_month', toBillingMonth(filter.year, filter.month))
    }
    if (filter.companyId) q = q.eq('company_id', filter.companyId)
    if (filter.invoiced === true) q = q.not('invoice_id', 'is', null)
    if (filter.invoiced === false) q = q.is('invoice_id', null)

    const { data, error } = await q
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching receivables:', error)
    return { data: null, error }
  }
}

/**
 * 月内未請求の売掛を企業ごとに集約 (請求書発行画面のサマリ用)。
 * @returns {Promise<{data: Array<{company_id, company_name, line_count, total_amount}>|null, error}>}
 */
export async function getUnbilledByCompany(year, month) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const billingMonth = toBillingMonth(year, month)
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select('company_id, amount, companies(id, name, invoice_display_name)')
      .eq('billing_month', billingMonth)
      .is('invoice_id', null)
    if (error) throw error

    const map = new Map()
    for (const row of data || []) {
      const key = row.company_id
      const existing = map.get(key) || {
        company_id: key,
        company_name: row.companies?.name ?? '',
        invoice_display_name: row.companies?.invoice_display_name ?? null,
        line_count: 0,
        total_amount: 0,
      }
      existing.line_count += 1
      existing.total_amount += row.amount
      map.set(key, existing)
    }
    return {
      data: Array.from(map.values()).sort(
        (a, b) => b.total_amount - a.total_amount
      ),
      error: null,
    }
  } catch (error) {
    console.error('Error aggregating unbilled receivables:', error)
    return { data: null, error }
  }
}

export async function createReceivable(payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('accounts_receivable')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating receivable:', error)
    return { data: null, error }
  }
}

export async function updateReceivable(id, payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('accounts_receivable')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating receivable:', error)
    return { data: null, error }
  }
}

export async function deleteReceivable(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { error } = await supabase
      .from('accounts_receivable')
      .delete()
      .eq('id', id)
    if (error) throw error
    return { data: { id }, error: null }
  } catch (error) {
    console.error('Error deleting receivable:', error)
    return { data: null, error }
  }
}

/**
 * 指定日の売掛一覧（全取引先）
 */
export async function getReceivablesByWorkDate(workDate) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select('*, companies(id, name, invoice_display_name), invoices(id, paid_at)')
      .eq('work_date', workDate)
      .order('id', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching receivables by work_date:', error)
    return { data: null, error }
  }
}

async function sumReceivableTotalForWorkDate(workDate) {
  const { data, error } = await supabase
    .from('accounts_receivable')
    .select('amount')
    .eq('work_date', workDate)
  if (error) throw error
  return (data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
}

/**
 * シフト表モーダル用: 請求先未選択のシフト由来売掛を置き換え、当日合計を返す。
 */
export async function replaceShiftReceivables(workDate, lines = [], carNum = null) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    let deleteQuery = supabase
      .from('accounts_receivable')
      .delete()
      .eq('work_date', workDate)
      .eq('source_file', 'shift-calendar')
      .is('company_id', null)

    if (carNum != null) {
      deleteQuery = deleteQuery.eq('vehicle_num', Number(carNum))
    }

    const { error: deleteError } = await deleteQuery
    if (deleteError) throw deleteError

    const payloads = buildShiftReceivableInsertPayloads(workDate, lines, carNum)
    if (payloads.length > 0) {
      const { error: insertError } = await supabase
        .from('accounts_receivable')
        .insert(payloads)
      if (insertError) throw insertError
    }

    const total = await sumReceivableTotalForWorkDate(workDate)
    return { data: { work_date: workDate, receivable_total: total }, error: null }
  } catch (error) {
    console.error('Error replacing shift receivables:', error)
    return { data: null, error }
  }
}
