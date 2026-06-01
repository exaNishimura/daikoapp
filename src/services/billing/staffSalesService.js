import { supabase } from '@/lib/supabase'

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

function monthRange(year, month) {
  const m = String(month).padStart(2, '0')
  const start = `${year}-${m}-01`
  const next =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { start, next }
}

export async function getStaffSalesByMonth(year, month) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { start, next } = monthRange(year, month)
    const { data, error } = await supabase
      .from('daily_staff_sales')
      .select('*')
      .gte('work_date', start)
      .lt('work_date', next)
      .order('work_date', { ascending: true })
      .order('staff_name', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching daily_staff_sales by month:', error)
    return { data: null, error }
  }
}

export async function getStaffSalesByDate(date) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('daily_staff_sales')
      .select('*')
      .eq('work_date', date)
      .order('staff_name', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching daily_staff_sales by date:', error)
    return { data: null, error }
  }
}

/**
 * 日次 + スタッフ単位 UPSERT (work_date, staff_name を conflict キー)。
 */
export async function upsertStaffSale(payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('daily_staff_sales')
      .upsert(payload, { onConflict: 'work_date,staff_name' })
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error upserting daily_staff_sales:', error)
    return { data: null, error }
  }
}

/**
 * バルク upsert (Excel インポート / 1 日分まとめて入力時)。
 */
export async function upsertStaffSalesBulk(rows) {
  if (!supabase) return NOT_INITIALIZED()
  if (!Array.isArray(rows) || rows.length === 0) return { data: [], error: null }
  try {
    const { data, error } = await supabase
      .from('daily_staff_sales')
      .upsert(rows, { onConflict: 'work_date,staff_name' })
      .select()
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error bulk upserting daily_staff_sales:', error)
    return { data: null, error }
  }
}

export async function deleteStaffSale(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { error } = await supabase
      .from('daily_staff_sales')
      .delete()
      .eq('id', id)
    if (error) throw error
    return { data: { id }, error: null }
  } catch (error) {
    console.error('Error deleting daily_staff_sales:', error)
    return { data: null, error }
  }
}
