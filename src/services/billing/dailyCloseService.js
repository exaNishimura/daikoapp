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

/**
 * 締め済み日の LINE 報告を最新入力で再送する（管理者セッション必須）
 * @param {string} workDate YYYY-MM-DD
 */
export async function resendDailyCloseReport(workDate) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }
  if (!workDate) {
    return { data: null, error: new Error('workDate required') }
  }

  const functionsBase = import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
    : ''
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!functionsBase) {
    return { data: null, error: new Error('VITE_SUPABASE_URL not configured') }
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { data: null, error: new Error('ログインが必要です') }
    }

    const res = await fetch(`${functionsBase}/daily-close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: anon,
      },
      body: JSON.stringify({ work_date: workDate, force: true }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        data: null,
        error: new Error(data.error || `HTTP ${res.status}`),
        status: res.status,
        raw: data,
      }
    }
    return { data, error: null }
  } catch (error) {
    console.error('resendDailyCloseReport error:', error)
    return { data: null, error }
  }
}
