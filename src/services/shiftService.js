import { supabase } from '@/lib/supabase'

/**
 * シフトデータを取得
 * @param {string} startDate - 開始日（YYYY-MM-DD形式、オプション）
 * @param {string} endDate - 終了日（YYYY-MM-DD形式、オプション）
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getShifts(startDate = null, endDate = null) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    let query = supabase
      .from('shifts')
      .select('*')
      .order('date', { ascending: true })
      .order('car', { ascending: true })
      .order('start', { ascending: true })

    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data, error } = await query

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching shifts:', error)
    return { data: null, error }
  }
}

/**
 * シフトデータを作成
 * @param {Object} shiftData - シフトデータ
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function createShift(shiftData) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('shifts')
      .insert(shiftData)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating shift:', error)
    return { data: null, error }
  }
}

/**
 * シフトデータを更新
 * @param {string} id - シフトID
 * @param {Object} shiftData - 更新するシフトデータ
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function updateShift(id, shiftData) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('shifts')
      .update(shiftData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating shift:', error)
    return { data: null, error }
  }
}

/**
 * シフトデータを削除
 * @param {string} id - シフトID
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function deleteShift(id) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error deleting shift:', error)
    return { data: null, error }
  }
}

/**
 * 指定日のシフトデータを一括削除
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function deleteShiftsByDate(date) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('shifts')
      .delete()
      .eq('date', date)
      .select()

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error deleting shifts by date:', error)
    return { data: null, error }
  }
}

/**
 * シフトデータを一括作成
 * @param {Array} shifts - シフトデータの配列
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function createShiftsBulk(shifts) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('shifts')
      .insert(shifts)
      .select()

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error creating shifts bulk:', error)
    return { data: null, error }
  }
}

