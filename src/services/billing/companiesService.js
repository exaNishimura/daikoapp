import { supabase } from '@/lib/supabase'

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
 * 論理削除 (is_active = false)。FK 制約で物理削除はできないため。
 */
export async function deactivateCompany(id) {
  return updateCompany(id, { is_active: false })
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
