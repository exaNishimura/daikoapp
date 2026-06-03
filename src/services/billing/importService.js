import { supabase } from '@/lib/supabase'

/**
 * 月単位の一括インポート RPC `bulk_import_receivables` を呼ぶ。
 *
 * 入力: buildImportPlan の戻り値 (period / source_file / daily_sales / staff_sales /
 *       receivables / fixed_expenses) と overwrite フラグ。
 *
 * 戻り: { inserted: {...}, deleted: {...} } の JSONB。
 */
export async function bulkImportReceivables({
  period,
  source_file,
  overwrite = false,
  daily_sales = [],
  staff_sales = [],
  receivables = [],
  fixed_expenses = [],
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }
  if (!period) {
    return { data: null, error: new Error('period is required') }
  }
  try {
    const { data, error } = await supabase.rpc('bulk_import_receivables', {
      p_period: period,
      p_source_file: source_file ?? '',
      p_overwrite: !!overwrite,
      p_daily_sales: daily_sales,
      p_staff_sales: staff_sales,
      p_receivables: receivables,
      p_fixed_expenses: fixed_expenses,
    })
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error in bulk_import_receivables:', error)
    return { data: null, error }
  }
}
