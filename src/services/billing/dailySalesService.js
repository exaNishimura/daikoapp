import { supabase } from '@/lib/supabase'

/**
 * daily_sales (日次売上集計) サービス。
 *
 * total_sales / profit は GENERATED ALWAYS AS STORED 列のため insert/update では指定しない。
 */

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

/** "YYYY-MM-01" を作る (yearMonth 検索用) */
function monthRange(year, month) {
  const m = String(month).padStart(2, '0')
  const start = `${year}-${m}-01`
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { start, next }
}

const WRITABLE_COLUMNS = [
  'work_date',
  'vehicle1_distance_km',
  'vehicle2_distance_km',
  'vehicle1_fuel_yen',
  'vehicle2_fuel_yen',
  'vehicle1_sales',
  'vehicle2_sales',
  'total_hours',
  'receivable_total',
  'vehicle1_expense_note',
  'vehicle2_expense_note',
  'vehicle1_expense_amount',
  'vehicle2_expense_amount',
  'labor_cost',
  'cash',
  'source_file',
]

function pickWritable(payload) {
  const out = {}
  for (const k of WRITABLE_COLUMNS) {
    if (k in payload) out[k] = payload[k]
  }
  return out
}

export async function getDailySalesByMonth(year, month) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { start, next } = monthRange(year, month)
    const { data, error } = await supabase
      .from('daily_sales')
      .select('*')
      .gte('work_date', start)
      .lt('work_date', next)
      .order('work_date', { ascending: true })
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching daily_sales by month:', error)
    return { data: null, error }
  }
}

export async function getDailySalesByDate(date) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase
      .from('daily_sales')
      .select('*')
      .eq('work_date', date)
      .maybeSingle()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching daily_sales by date:', error)
    return { data: null, error }
  }
}

/**
 * 日付単位 UPSERT (work_date を conflict キー)。
 * GENERATED 列 (total_sales, profit) は除外して送る。
 */
export async function upsertDailySale(payload) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const safe = pickWritable(payload)
    const { data, error } = await supabase
      .from('daily_sales')
      .upsert(safe, { onConflict: 'work_date' })
      .select()
    if (error) throw error

    let row = data?.[0] ?? null
    if (!row && safe.work_date) {
      const refetch = await getDailySalesByDate(safe.work_date)
      if (refetch.error) throw refetch.error
      row = refetch.data
    }
    if (!row) {
      throw new Error(
        '売上の保存後にデータを取得できませんでした。DBの権限設定（daily_sales の anon 書き込み）を確認してください'
      )
    }
    return { data: row, error: null }
  } catch (error) {
    console.error('Error upserting daily_sales:', error)
    return { data: null, error }
  }
}

export async function deleteDailySale(workDate) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { error } = await supabase
      .from('daily_sales')
      .delete()
      .eq('work_date', workDate)
    if (error) throw error
    return { data: { work_date: workDate }, error: null }
  } catch (error) {
    console.error('Error deleting daily_sales:', error)
    return { data: null, error }
  }
}
