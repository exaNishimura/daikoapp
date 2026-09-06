import { supabase } from '@/lib/supabase'
import { companyDeleteError } from '@/lib/billing/companyForm'

/**
 * 取引先マスタ (companies) の CRUD サービス。
 *
 * 戻り値はアプリ共通の `{ data, error }` 形式。hooks 層で `unwrap` する。
 */

/**
 * @typedef {Object} CompanyRow
 * @property {number}        id
 * @property {string}        name
 * @property {string|null}   invoice_display_name
 * @property {string[]}      aliases
 * @property {number}        display_order
 * @property {boolean}       is_active
 * @property {string|null}   memo
 */

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

/**
 * 全件取得。display_order 昇順、name 昇順。
 * @param {{ activeOnly?: boolean }} [options]
 */
export async function getCompanies(options = {}) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    let q = supabase
      .from('companies')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
    if (options.activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching companies:', error)
    return { data: null, error }
  }
}

/**
 * 1 件取得 (id 指定)。
 */
export async function getCompany(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase.from('companies').select('*').eq('id', id).single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching company:', error)
    return { data: null, error }
  }
}

/**
 * 新規作成。
 */
export async function createCompany(payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase.from('companies').insert(payload).select().single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating company:', error)
    return { data: null, error }
  }
}

/**
 * 更新。
 */
export async function updateCompany(id, payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating company:', error)
    return { data: null, error }
  }
}

/**
 * 論理削除 (is_active = false)。売掛履歴を残したいときの無効化。
 */
export async function deactivateCompany(id) {
  return updateCompany(id, { is_active: false })
}

/**
 * 無効化した取引先の参照件数（売掛 / 請求書）。
 */
export async function getCompanyUsage(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const [receivables, invoices] = await Promise.all([
      supabase
        .from('accounts_receivable')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', id),
    ])
    if (receivables.error) throw receivables.error
    if (invoices.error) throw invoices.error
    return {
      data: {
        receivableCount: receivables.count ?? 0,
        invoiceCount: invoices.count ?? 0,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error counting company usage:', error)
    return { data: null, error }
  }
}

/**
 * 物理削除。無効かつ売掛・請求書が 0 件のときだけ許可。
 */
export async function deleteCompany(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const [companyRes, usageRes] = await Promise.all([getCompany(id), getCompanyUsage(id)])
    if (companyRes.error) throw companyRes.error
    if (usageRes.error) throw usageRes.error

    const blocked = companyDeleteError(companyRes.data, usageRes.data)
    if (blocked) return { data: null, error: new Error(blocked) }

    const { data, error } = await supabase.from('companies').delete().eq('id', id).select().single()
    if (error) {
      if (error.code === '23503') {
        return {
          data: null,
          error: new Error('売掛または請求書が残っているため削除できません'),
        }
      }
      throw error
    }
    return { data, error: null }
  } catch (error) {
    console.error('Error deleting company:', error)
    return { data: null, error }
  }
}

/**
 * 並び順を一括更新する (ドラッグ並び替え用)。
 * @param {Array<{ id: number, display_order: number }>} orderedRows
 */
export async function reorderCompanies(orderedRows) {
  if (!supabase) return NOT_INITIALIZED()
  if (!Array.isArray(orderedRows) || orderedRows.length === 0) {
    return { data: [], error: null }
  }
  try {
    // PostgREST は単一 upsert で一括更新できる。primary key 一致なら updateBehavior。
    // companies に必須カラム (name) があるため、id だけだと NOT NULL 違反になる。
    // → Promise.all で個別 update する (件数は最大数十件想定なので問題なし)。
    const results = await Promise.all(
      orderedRows.map(({ id, display_order }) =>
        supabase.from('companies').update({ display_order }).eq('id', id).select().single()
      )
    )
    const firstError = results.find((r) => r.error)?.error
    if (firstError) throw firstError
    return { data: results.map((r) => r.data), error: null }
  } catch (error) {
    console.error('Error reordering companies:', error)
    return { data: null, error }
  }
}
