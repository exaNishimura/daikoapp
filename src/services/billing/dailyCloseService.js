import { supabase } from '@/lib/supabase'

function monthRange(year, month) {
  const m = String(month).padStart(2, '0')
  const start = `${year}-${m}-01`
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { start, next }
}

export async function getDailyClosuresByMonth(year, month) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }
  try {
    const { start, next } = monthRange(year, month)
    const { data, error } = await supabase
      .from('daily_day_closures')
      .select('work_date, closed_at, closed_by')
      .gte('work_date', start)
      .lt('work_date', next)
      .order('work_date', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching daily_day_closures:', error)
    return { data: null, error }
  }
}

export function indexClosuresByDate(rows) {
  const map = {}
  for (const row of rows ?? []) {
    if (row?.work_date) map[row.work_date] = row
  }
  return map
}
