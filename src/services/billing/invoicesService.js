import { supabase } from '@/lib/supabase'
import { formatIsoDate } from '@/lib/excel/formatters'

/**
 * invoices (請求書ヘッダ) サービス。
 *
 * 発行・取消・入金は RPC (`issue_invoice` / `revoke_invoice` / `mark_invoice_paid`)
 * を経由する。アプリ側で個別 INSERT/UPDATE すると accounts_receivable.invoice_id
 * との整合が取れなくなるため。
 */

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

function toBillingMonth(year, month) {
  const m = String(month).padStart(2, '0')
  return `${year}-${m}-01`
}

/**
 * 請求書一覧 (フィルタ付き)。
 * @param {Object} [filter]
 * @param {number} [filter.year]
 * @param {number} [filter.month]
 * @param {number} [filter.companyId]
 * @param {boolean} [filter.unpaidOnly]
 */
export async function getInvoices(filter = {}) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    let q = supabase
      .from('invoices')
      .select('*, companies(id, name, invoice_display_name)')
      .order('billing_month', { ascending: false })
      .order('issue_date', { ascending: false })
      .order('id', { ascending: false })

    if (filter.year && filter.month) {
      q = q.eq('billing_month', toBillingMonth(filter.year, filter.month))
    }
    if (filter.companyId) q = q.eq('company_id', filter.companyId)
    if (filter.unpaidOnly) q = q.is('paid_at', null)

    const { data, error } = await q
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return { data: null, error }
  }
}

export async function getInvoice(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, companies(id, name, invoice_display_name), accounts_receivable(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return { data: null, error }
  }
}

/**
 * 請求書発行 RPC を呼ぶ。
 * @param {Object} params
 * @param {number}   params.companyId
 * @param {number}   params.year
 * @param {number}   params.month
 * @param {Date|string} params.issueDate
 * @param {number}   params.totalAmount
 * @param {number}   params.lineCount
 * @param {Object}   params.profileSnapshot
 * @param {string|null} [params.filePath]
 * @param {number[]|null} [params.receivableIds]
 *   指定時はその売掛だけ紐付ける（再発行・部分発行用）。省略時は未請求全件。
 */
export async function issueInvoice(params) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const issueDateStr =
      params.issueDate instanceof Date ? formatIsoDate(params.issueDate) : params.issueDate
    const payload = {
      p_company_id: params.companyId,
      p_billing_month: toBillingMonth(params.year, params.month),
      p_issue_date: issueDateStr,
      p_total_amount: params.totalAmount,
      p_line_count: params.lineCount,
      p_profile_snapshot: params.profileSnapshot,
      p_file_path: params.filePath ?? null,
    }
    if (Array.isArray(params.receivableIds) && params.receivableIds.length > 0) {
      payload.p_receivable_ids = params.receivableIds
    }
    const { data, error } = await supabase.rpc('issue_invoice', payload)
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error issuing invoice:', error)
    return { data: null, error }
  }
}

/**
 * 発行済 invoice の file_path を更新する (Storage アップロード後に呼ぶ)。
 */
export async function updateInvoiceFilePath(invoiceId, filePath) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('invoices')
      .update({ file_path: filePath })
      .eq('id', invoiceId)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating invoice file_path:', error)
    return { data: null, error }
  }
}

export async function revokeInvoice(invoiceId) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { error } = await supabase.rpc('revoke_invoice', {
      p_invoice_id: invoiceId,
    })
    if (error) throw error
    return { data: { id: invoiceId }, error: null }
  } catch (error) {
    console.error('Error revoking invoice:', error)
    return { data: null, error }
  }
}

export async function markInvoicePaid(invoiceId, paidAt) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const paidAtStr = paidAt instanceof Date ? paidAt.toISOString() : (paidAt ?? null)
    const { data, error } = await supabase.rpc('mark_invoice_paid', {
      p_invoice_id: invoiceId,
      ...(paidAtStr ? { p_paid_at: paidAtStr } : {}),
    })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error marking invoice paid:', error)
    return { data: null, error }
  }
}
