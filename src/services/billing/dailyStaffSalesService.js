import { supabase } from '@/lib/supabase'

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

/** "YYYY-MM-01" を作る */
function monthRange(year, month) {
  const m = String(month).padStart(2, '0')
  const start = `${year}-${m}-01`
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { start, next }
}

export async function getDailyStaffSalesByDate(workDate) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('daily_staff_sales')
      .select('*')
      .eq('work_date', workDate)
      .order('staff_name', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching daily_staff_sales by date:', error)
    return { data: null, error }
  }
}

export async function getDailyStaffSalesByMonth(year, month) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { start, next } = monthRange(year, month)
    const { data, error } = await supabase
      .from('daily_staff_sales')
      .select('*')
      .gte('work_date', start)
      .lt('work_date', next)
      .order('work_date', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching daily_staff_sales by month:', error)
    return { data: null, error }
  }
}

/**
 * 日付単位でスタッフ別稼働時間を一括 UPSERT
 */
export async function upsertDailyStaffSalesBatch(workDate, rows) {
  if (!supabase) return NOT_INITIALIZED()
  if (!rows?.length) return { data: [], error: null }
  try {
    const payload = rows.map((r) => ({
      work_date: workDate,
      staff_name: r.staff_name,
      hours: r.hours ?? 0,
      sales: r.sales ?? 0,
    }))
    const { data, error } = await supabase
      .from('daily_staff_sales')
      .upsert(payload, { onConflict: 'work_date,staff_name' })
      .select()
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error upserting daily_staff_sales:', error)
    return { data: null, error }
  }
}
