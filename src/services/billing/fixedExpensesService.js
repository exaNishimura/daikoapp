import { supabase } from '@/lib/supabase'

/**
 * monthly_fixed_expenses (月額固定経費) サービス。
 * UNIQUE (billing_month, label) で重複防止。
 */

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

function toBillingMonth(year, month) {
  const m = String(month).padStart(2, '0')
  return `${year}-${m}-01`
}

export async function getFixedExpensesByMonth(year, month) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('monthly_fixed_expenses')
      .select('*')
      .eq('billing_month', toBillingMonth(year, month))
      .order('display_order', { ascending: true })
      .order('label', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching monthly_fixed_expenses:', error)
    return { data: null, error }
  }
}

export async function upsertFixedExpense(payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('monthly_fixed_expenses')
      .upsert(payload, { onConflict: 'billing_month,label' })
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error upserting monthly_fixed_expenses:', error)
    return { data: null, error }
  }
}

export async function upsertFixedExpensesBulk(rows) {
  if (!supabase) return NOT_INITIALIZED()
  if (!Array.isArray(rows) || rows.length === 0) return { data: [], error: null }
  try {
    const { data, error } = await supabase
      .from('monthly_fixed_expenses')
      .upsert(rows, { onConflict: 'billing_month,label' })
      .select()
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error bulk upserting monthly_fixed_expenses:', error)
    return { data: null, error }
  }
}

export async function deleteFixedExpense(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { error } = await supabase
      .from('monthly_fixed_expenses')
      .delete()
      .eq('id', id)
    if (error) throw error
    return { data: { id }, error: null }
  } catch (error) {
    console.error('Error deleting monthly_fixed_expenses:', error)
    return { data: null, error }
  }
}
