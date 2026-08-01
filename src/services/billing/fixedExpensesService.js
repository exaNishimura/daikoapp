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
      .order('label', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching monthly_fixed_expenses:', error)
    return { data: null, error }
  }
}

function prevYearMonth(year, month) {
  if (month <= 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

/**
 * 当月の固定経費を取得。未登録なら前月の label/amount を引き継いで作成する。
 * @returns {{ data: Array|null, error: Error|null, carriedOver?: boolean }}
 */
export async function getFixedExpensesByMonthWithCarryOver(year, month) {
  const current = await getFixedExpensesByMonth(year, month)
  if (current.error) return current
  if ((current.data?.length ?? 0) > 0) {
    return { data: current.data, error: null, carriedOver: false }
  }

  const prev = prevYearMonth(year, month)
  const previous = await getFixedExpensesByMonth(prev.year, prev.month)
  if (previous.error) return previous
  if (!previous.data?.length) {
    return { data: [], error: null, carriedOver: false }
  }

  const billingMonth = toBillingMonth(year, month)
  const rows = previous.data.map((r) => ({
    billing_month: billingMonth,
    label: r.label,
    amount: Number(r.amount) || 0,
    source_file: r.source_file ?? null,
  }))

  const upserted = await upsertFixedExpensesBulk(rows)
  if (upserted.error) return upserted
  return { data: upserted.data || [], error: null, carriedOver: true }
}

export async function upsertFixedExpense(payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    // id あり → UPDATE（項目名変更に対応。onConflict(label) だと旧行が残る）
    if (payload?.id != null) {
      const { id, ...rest } = payload
      const { data, error } = await supabase
        .from('monthly_fixed_expenses')
        .update(rest)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        if (error.code === '23505') {
          throw new Error('同じ項目名が既に登録されています')
        }
        throw error
      }
      return { data, error: null }
    }

    const { id: _id, ...rest } = payload
    const { data, error } = await supabase
      .from('monthly_fixed_expenses')
      .upsert(rest, { onConflict: 'billing_month,label' })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') {
        throw new Error('同じ項目名が既に登録されています')
      }
      throw error
    }
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
