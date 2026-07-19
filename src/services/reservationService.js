import { supabase } from '@/lib/supabase'
import { getCalendarDayRange } from '@/lib/reservation/reservationWindowUtils'

const NOT_INITIALIZED = () => ({
  data: null,
  error: new Error('Supabase client not initialized'),
})

/**
 * 必須チェック（UI / Service 共用）
 * @param {{ reserved_at?: string, customer_name?: string, phone?: string, memo?: string }} input
 * @returns {string[]} 不足フィールド名
 */
export function missingReservationFields(input) {
  const missing = []
  if (!input?.reserved_at || String(input.reserved_at).trim() === '') {
    missing.push('reserved_at')
  }
  if (!input?.customer_name || String(input.customer_name).trim() === '') {
    missing.push('customer_name')
  }
  if (!input?.phone || String(input.phone).trim() === '') {
    missing.push('phone')
  }
  return missing
}

function escapeIlike(value) {
  return String(value).replace(/[%_\\]/g, '\\$&')
}

/**
 * @param {{ dateFrom?: string, dateTo?: string, q?: string }} [filters]
 */
export async function listReservations(filters = {}) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    let query = supabase.from('reservations').select('*').order('reserved_at', { ascending: true })

    if (filters.dateFrom) {
      const { startIso } = getCalendarDayRange(filters.dateFrom)
      query = query.gte('reserved_at', startIso)
    }
    if (filters.dateTo) {
      const { endIso } = getCalendarDayRange(filters.dateTo)
      query = query.lt('reserved_at', endIso)
    }
    if (filters.q && String(filters.q).trim()) {
      const q = escapeIlike(String(filters.q).trim())
      query = query.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error listing reservations:', error)
    return { data: null, error }
  }
}

/**
 * @param {number} year
 * @param {number} month 1-12
 */
export async function listReservationsByMonth(year, month) {
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const dateFrom = `${year}-${mm}-01`
  const dateTo = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
  return listReservations({ dateFrom, dateTo })
}

export async function getReservation(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { data, error } = await supabase.from('reservations').select('*').eq('id', id).single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching reservation:', error)
    return { data: null, error }
  }
}

/**
 * @param {{ reserved_at: string, customer_name: string, phone: string, memo?: string }} input
 */
export async function createReservation(input) {
  if (!supabase) return NOT_INITIALIZED()
  const missing = missingReservationFields(input)
  if (missing.length) {
    return {
      data: null,
      error: new Error(`必須項目が未入力です: ${missing.join(', ')}`),
    }
  }
  try {
    const row = {
      reserved_at: input.reserved_at,
      customer_name: String(input.customer_name).trim(),
      phone: String(input.phone).trim(),
      memo: input.memo != null ? String(input.memo) : '',
    }
    const { data, error } = await supabase.from('reservations').insert(row).select().single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error creating reservation:', error)
    return { data: null, error }
  }
}

/**
 * @param {string} id
 * @param {Partial<{ reserved_at: string, customer_name: string, phone: string, memo: string }>} patch
 */
export async function updateReservation(id, patch) {
  if (!supabase) return NOT_INITIALIZED()
  const merged = {
    reserved_at: patch.reserved_at,
    customer_name: patch.customer_name,
    phone: patch.phone,
    memo: patch.memo,
  }
  // 渡された必須キーだけ再検証（部分更新時は省略可だが日時/氏名/電話を空にはできない）
  for (const key of ['reserved_at', 'customer_name', 'phone']) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      if (!patch[key] || String(patch[key]).trim() === '') {
        return { data: null, error: new Error(`必須項目が未入力です: ${key}`) }
      }
    }
  }
  try {
    const row = {}
    if (merged.reserved_at != null) row.reserved_at = merged.reserved_at
    if (merged.customer_name != null) row.customer_name = String(merged.customer_name).trim()
    if (merged.phone != null) row.phone = String(merged.phone).trim()
    if (merged.memo != null) row.memo = String(merged.memo)

    const { data, error } = await supabase
      .from('reservations')
      .update(row)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating reservation:', error)
    return { data: null, error }
  }
}

export async function deleteReservation(id) {
  if (!supabase) return NOT_INITIALIZED()
  try {
    const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (error) throw error
    return { data: { id }, error: null }
  } catch (error) {
    console.error('Error deleting reservation:', error)
    return { data: null, error }
  }
}
